/**
 * Harvest AI Service
 * ─────────────────────────────────────────────────────────────────
 * Integrates with the Hugging Face Inference API for:
 *  - Text inference  → farming advice, diagnosis, planning Q&A
 *  - Image inference → crop disease detection, livestock analysis
 *
 * Automatically falls back to the local agricultureKnowledge.ts
 * knowledge base if the HF API fails, times out, or is unavailable.
 *
 * All responses conform to the standardized AIResponse interface.
 *
 * Environment variable required: VITE_HF_API_KEY
 */

import { getGuidance } from "@/lib/agricultureKnowledge";
import type { GuidanceResponse, AssistantMode } from "@/lib/agricultureKnowledge";

// ─── Model Configuration (change here to switch models) ──────────────────────

const MODELS = {
  /**
   * Chat/instruction model for text inference.
   * Must support the HF Inference API /v1/chat/completions endpoint.
   */
  text: "mistralai/Mistral-7B-Instruct-v0.3",

  /**
   * Vision model for image-based crop/livestock analysis.
   * Uses the binary image upload endpoint.
   */
  image: "google/vit-base-patch16-224",

  /**
   * Specialized plant disease classification model (preferred for diagnosis).
   * Falls back to the general image model if this model is unavailable.
   */
  plantDisease: "linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification",
} as const;

const HF_BASE = "https://api-inference.huggingface.co";
const REQUEST_TIMEOUT_MS = 20_000;   // 20 seconds
const CACHE_TTL_MS       = 5 * 60 * 1000;  // 5 minutes

// ─── Public Types ─────────────────────────────────────────────────────────────

export type ConfidenceLevel = "high" | "medium" | "low";
export type AISource = "huggingface" | "fallback";

export interface ImagePrediction {
  label: string;
  score: number;       // 0–1
  advice?: string;
}

/**
 * Standardized AI response returned by both text and image functions.
 * When source === "fallback", the guidance field contains the full
 * structured GuidanceResponse for rich display in the UI.
 */
export interface AIResponse {
  message: string;
  confidence: ConfidenceLevel;
  nextSteps: string[];
  source: AISource;
  model?: string;
  predictions?: ImagePrediction[];
  /** Only present on fallback responses — enables rich GuidanceCard display */
  guidance?: GuidanceResponse;
}

export interface FarmingContext {
  cropType?: string;
  livestockType?: string;
  location?: string;
  /** "long_rains" | "short_rains" | "dry" */
  season?: string;
  mode?: AssistantMode;
  farmActivities?: string[];
}

// ─── In-Memory Cache ──────────────────────────────────────────────────────────

interface CacheEntry {
  response: AIResponse;
  expiresAt: number;
}

const _cache = new Map<string, CacheEntry>();

function getCached(key: string): AIResponse | null {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { _cache.delete(key); return null; }
  return entry.response;
}

function setCached(key: string, response: AIResponse): void {
  _cache.set(key, { response, expiresAt: Date.now() + CACHE_TTL_MS });
  // Mirror to localStorage for persistence across page reloads (text only)
  try {
    const lsKey = `harvest_ai_${key}`;
    localStorage.setItem(lsKey, JSON.stringify({ response, expiresAt: Date.now() + CACHE_TTL_MS }));
  } catch { /* quota errors are non-fatal */ }
}

function getLocalStorage(key: string): AIResponse | null {
  try {
    const raw = localStorage.getItem(`harvest_ai_${key}`);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() > entry.expiresAt) { localStorage.removeItem(`harvest_ai_${key}`); return null; }
    return entry.response;
  } catch { return null; }
}

/** Clear all cached AI responses (call on logout or manual refresh) */
export function clearAICache(): void {
  _cache.clear();
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("harvest_ai_")) localStorage.removeItem(key);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getApiKey(): string {
  return import.meta.env.VITE_HF_API_KEY ?? "";
}

function buildCacheKey(prompt: string, context?: FarmingContext): string {
  return btoa(encodeURIComponent(`${prompt}|${JSON.stringify(context || {})}`)).slice(0, 64);
}

/**
 * Creates a fetch call that automatically aborts after REQUEST_TIMEOUT_MS.
 */
async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/** Extract numbered steps from a free-form text response. */
function extractNextSteps(text: string): string[] {
  const lines = text.split("\n");
  const steps: string[] = [];
  for (const line of lines) {
    const match = line.match(/^\s*(?:\d+[\.\):]|[-•*])\s+(.+)/);
    if (match) steps.push(match[1].trim());
  }
  if (steps.length > 0) return steps.slice(0, 6);
  // Fallback: split on sentences and take first 3
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.length > 20)
    .slice(0, 3);
}

function contextToString(context?: FarmingContext): string {
  if (!context) return "general Kenyan farmer";
  const parts: string[] = [];
  if (context.cropType)      parts.push(`growing ${context.cropType}`);
  if (context.livestockType) parts.push(`raising ${context.livestockType}`);
  if (context.location)      parts.push(`located in ${context.location}`);
  if (context.season)        parts.push(`during ${context.season.replace("_", " ")} season`);
  if (context.farmActivities?.length)
    parts.push(`with ${context.farmActivities.join(", ")} activities`);
  return parts.length ? parts.join(", ") : "general Kenyan smallholder farmer";
}

function getCurrentSeason(): string {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5)  return "long rains season (March–May)";
  if (month >= 10 && month <= 12) return "short rains season (October–December)";
  return "dry season";
}

// ─── Fallback Builder ─────────────────────────────────────────────────────────

function buildFallbackResponse(query: string, mode: AssistantMode = "advice"): AIResponse {
  const guidance = getGuidance(query, mode);
  const nextSteps = guidance.sections.flatMap((s) => s.points).slice(0, 5);
  return {
    message: guidance.summary,
    confidence: "medium",
    nextSteps,
    source: "fallback",
    guidance,
  };
}

// ─── Text Inference ───────────────────────────────────────────────────────────

/**
 * Build the system + user prompt tailored to Kenya / East Africa farming.
 */
function buildTextPrompt(query: string, context?: FarmingContext, mode?: AssistantMode): string {
  const season = context?.season ? context.season.replace("_", " ") + " season" : getCurrentSeason();
  const contextStr = contextToString(context);
  const modeInstruction =
    mode === "diagnosis"
      ? "Focus on identifying the problem, its likely cause, and immediate remediation steps."
      : mode === "planning"
      ? "Focus on scheduling, timing, and resource planning steps."
      : "Focus on practical farming best practices.";

  return `You are Harvest AI, an expert agricultural advisor for Kenya and East Africa.
Farmer profile: ${contextStr}. Current season: ${season}.
${modeInstruction}
Rules:
- Be concise, practical, and use simple language suitable for smallholder farmers.
- Mention specific local products, seed varieties, or organizations where relevant (e.g. KALRO, Kenya Seed Company, Ministry of Agriculture).
- End your response with a numbered list of 3-5 immediate next steps prefixed with "Next steps:".
- Do NOT include preamble or sign-off phrases.

Farmer question: ${query}`;
}

/**
 * Send a text prompt to the HF chat completions endpoint.
 * Returns the raw assistant message string or throws.
 */
async function callHFText(prompt: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("VITE_HF_API_KEY not set");

  const res = await fetchWithTimeout(
    `${HF_BASE}/v1/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODELS.text,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 512,
        temperature: 0.4,
        stream: false,
      }),
    }
  );

  if (res.status === 503) {
    const body = await res.json().catch(() => ({}));
    const wait = (body as { estimated_time?: number }).estimated_time;
    throw new Error(`Model loading — estimated wait ${wait ? Math.ceil(wait) + "s" : "unknown"}`);
  }

  if (!res.ok) throw new Error(`HF API error ${res.status}: ${await res.text()}`);

  const data = await res.json() as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty response from HF API");
  return content;
}

/**
 * Score confidence from the raw response text.
 */
function scoreTextConfidence(raw: string): ConfidenceLevel {
  if (raw.length < 80) return "low";
  // Check for Kenya-specific signals
  const signals = ["kenya", "kalro", "nairobi", "rain", "season", "maize", "fertilizer",
    "extension", "arid", "highland", "ksh", "kilimo", "ministry"];
  const hits = signals.filter((s) => raw.toLowerCase().includes(s)).length;
  if (hits >= 3) return "high";
  if (hits >= 1) return "medium";
  return "medium";
}

/**
 * Primary public function: get farming advice / diagnosis / planning response.
 * Tries HF API first, falls back to local knowledge base.
 */
export async function queryAI(
  query: string,
  context?: FarmingContext,
  mode: AssistantMode = "advice"
): Promise<AIResponse> {
  const cacheKey = buildCacheKey(query, context);

  // 1. Check in-memory cache
  const cached = getCached(cacheKey) ?? getLocalStorage(cacheKey);
  if (cached) return { ...cached };

  // 2. Try HuggingFace
  try {
    const prompt = buildTextPrompt(query, context, mode);
    const raw = await callHFText(prompt);

    // Find "Next steps:" section
    const stepsIdx = raw.toLowerCase().indexOf("next steps:");
    const messagePart = stepsIdx !== -1 ? raw.slice(0, stepsIdx).trim() : raw;
    const stepsPart   = stepsIdx !== -1 ? raw.slice(stepsIdx) : raw;
    const nextSteps   = extractNextSteps(stepsPart);

    const response: AIResponse = {
      message: messagePart || raw,
      confidence: scoreTextConfidence(raw),
      nextSteps: nextSteps.length ? nextSteps : extractNextSteps(raw),
      source: "huggingface",
      model: MODELS.text,
    };

    setCached(cacheKey, response);
    return response;

  } catch (err) {
    console.warn("[aiService] HF text failed, using fallback:", (err as Error).message);
    const fallback = buildFallbackResponse(query, mode);
    // Don't cache fallbacks — retry HF next time
    return fallback;
  }
}

// ─── Image Inference ──────────────────────────────────────────────────────────

/**
 * Map predicted label → human-readable farming advice.
 */
function labelToAdvice(label: string, score: number): string {
  const l = label.toLowerCase();

  if (l.includes("healthy") || l.includes("normal"))
    return "Your crop appears healthy. Maintain current care routines.";
  if (l.includes("blight"))
    return "Possible blight detected. Remove affected leaves and apply copper-based fungicide immediately.";
  if (l.includes("rust"))
    return "Possible rust infection. Apply sulfur or mancozeb fungicide and improve air circulation.";
  if (l.includes("spot") || l.includes("cercospora"))
    return "Leaf spot disease suspected. Avoid overhead irrigation and apply fungicide per label.";
  if (l.includes("mildew"))
    return "Powdery or downy mildew detected. Apply potassium bicarbonate or sulfur-based fungicide.";
  if (l.includes("wilt"))
    return "Wilting symptoms detected. Check for fusarium or bacterial wilt. Improve drainage.";
  if (l.includes("mosaic") || l.includes("virus"))
    return "Possible viral infection. Remove affected plants, control aphid and whitefly vectors.";
  if (l.includes("armyworm") || l.includes("caterpillar") || l.includes("insect"))
    return "Pest infestation suspected. Scout fields and apply recommended pesticide if threshold is exceeded.";
  if (l.includes("deficiency") || l.includes("chlorosis") || l.includes("yellow"))
    return "Nutrient deficiency possible. Test soil pH and apply balanced fertilizer — nitrogen deficiency is common in Kenya.";
  if (l.includes("drought") || l.includes("dry"))
    return "Drought stress detected. Consider mulching and schedule irrigation if available.";

  if (score >= 0.7)
    return "Diagnosis uncertain with current image quality. Capture a close-up of affected leaves or stems for better accuracy.";
  return "Consult your local agricultural extension officer with this image for a professional assessment.";
}

/**
 * Convert file to binary array buffer for direct HF upload.
 */
async function fileToBinary(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Call HF image classification model with binary image data.
 */
async function callHFImage(file: File, modelId: string): Promise<{ label: string; score: number }[]> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("VITE_HF_API_KEY not set");

  const binary = await fileToBinary(file);

  const res = await fetchWithTimeout(
    `${HF_BASE}/models/${modelId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": file.type || "image/jpeg",
        Authorization: `Bearer ${apiKey}`,
      },
      body: binary,
    }
  );

  if (res.status === 503) {
    throw new Error("Image model still loading — try again in 20 seconds");
  }
  if (!res.ok) throw new Error(`HF image API error ${res.status}`);

  const data = await res.json() as { label?: string; score?: number }[] | unknown;
  if (!Array.isArray(data) || !data[0]?.label) throw new Error("Unexpected image response format");
  return (data as { label: string; score: number }[]).slice(0, 5);
}

/**
 * Build an overall message from top image predictions.
 */
function buildImageMessage(predictions: ImagePrediction[], context?: FarmingContext): string {
  const top = predictions[0];
  if (!top) return "Could not analyze the image. Please try a clearer, closer photo.";

  const subject = context?.cropType || context?.livestockType || "subject";
  const confidence = top.score >= 0.8 ? "high confidence" : top.score >= 0.5 ? "moderate confidence" : "low confidence";

  return `Analysis of your ${subject} image (${confidence}): The model identified "${top.label}" as the most likely condition. ${top.advice || ""}`;
}

/**
 * Analyze an uploaded farm image for disease, pest, or health assessment.
 * Tries plant-disease model first, then general vision model, then text fallback.
 */
export async function analyzeImage(
  imageFile: File,
  context?: FarmingContext
): Promise<AIResponse> {
  // Try plant disease model first, then general image model
  const modelsToTry = [MODELS.plantDisease, MODELS.image];

  for (const modelId of modelsToTry) {
    try {
      const rawPredictions = await callHFImage(imageFile, modelId);
      const predictions: ImagePrediction[] = rawPredictions.map((p) => ({
        label: p.label,
        score: Math.round(p.score * 100) / 100,
        advice: labelToAdvice(p.label, p.score),
      }));

      const topScore = predictions[0]?.score ?? 0;
      const confidence: ConfidenceLevel = topScore >= 0.75 ? "high" : topScore >= 0.45 ? "medium" : "low";

      const nextSteps = [
        predictions[0]?.advice || "Consult your local extension officer.",
        "Take a clear close-up photo of the affected plant part (leaf, stem, root).",
        "Record when the symptoms first appeared and which parts of the farm are affected.",
        "Isolate affected plants if possible to prevent spread.",
        "Contact Kenya Agricultural Extension Service or KALRO for on-site diagnosis.",
      ].filter(Boolean).slice(0, 5);

      return {
        message: buildImageMessage(predictions, context),
        confidence,
        nextSteps,
        source: "huggingface",
        model: modelId,
        predictions,
      };
    } catch (err) {
      console.warn(`[aiService] Image model ${modelId} failed:`, (err as Error).message);
    }
  }

  // Fallback: use text model to analyze context
  const query = `Image analysis fallback: ${context?.cropType || "crop"} showing potential problems — please provide general diagnosis guidance`;
  const fallback = buildFallbackResponse(query, "diagnosis");
  return {
    ...fallback,
    confidence: "low",
    predictions: [],
    message: `Image analysis is temporarily unavailable. ${fallback.message}`,
  };
}

// ─── Convenience / Activity-Specific ─────────────────────────────────────────

/**
 * Get targeted advice for a specific farm activity (crop/livestock name).
 * Used when user taps a farm activity chip in FarmAssistant.
 */
export async function queryActivityAdvice(
  activityName: string,
  activityType: string,
  context?: FarmingContext
): Promise<AIResponse> {
  const enrichedContext: FarmingContext = {
    ...context,
    cropType: activityType === "crop" || activityType === "aquaculture" ? activityName : context?.cropType,
    livestockType: ["livestock", "poultry", "beekeeping"].includes(activityType) ? activityName : context?.livestockType,
  };
  return queryAI(`What are the current best practices and upcoming tasks for my ${activityName} (${activityType})?`, enrichedContext, "advice");
}
