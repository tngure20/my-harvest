/**
 * Harvest AI Service — RAG-Powered Agricultural Advisor
 * ──────────────────────────────────────────────────────────────────
 * Architecture:
 *  1. RETRIEVE  — embed user query, find top-3 semantically similar
 *                 entries from the local knowledge base (RAG)
 *  2. GENERATE  — inject retrieved knowledge + weather context into
 *                 a structured prompt sent to Mistral-7B via HF
 *  3. VALIDATE  — verify response quality; retry once if weak
 *  4. FALLBACK  — if HF fails, build a structured response from
 *                 retrieved knowledge (never returns raw text)
 *
 * Environment variable: VITE_HF_API_KEY
 */

import { getGuidance, getKnowledgeCorpus } from "@/lib/agricultureKnowledge";
import type { GuidanceResponse, AssistantMode, CorpusEntry } from "@/lib/agricultureKnowledge";
import { retrieveTopK, clearEmbeddingCache } from "@/services/embeddingService";
import { getWeatherContext, weatherToPromptString } from "@/services/weatherService";

// ─── Model Configuration ──────────────────────────────────────────────────────

const MODELS = {
  text:         "mistralai/Mistral-7B-Instruct-v0.3",
  image:        "google/vit-base-patch16-224",
  plantDisease: "linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification",
} as const;

const HF_BASE              = "https://api-inference.huggingface.co";
const REQUEST_TIMEOUT_MS   = 25_000;
const RESPONSE_CACHE_TTL   = 5 * 60 * 1000;  // 5 minutes
const IMAGE_CONFIDENCE_MIN = 0.60;            // Threshold below which image is rejected

// ─── Trusted External Resources ───────────────────────────────────────────────

export interface TrustedResource {
  name: string;
  url: string;
  topics: string[];
}

const TRUSTED_RESOURCES: TrustedResource[] = [
  { name: "Kenya Ministry of Agriculture", url: "https://kilimo.go.ke",         topics: ["general", "policy", "planting", "fertilizer", "season"] },
  { name: "KALRO",                          url: "https://www.kalro.org",         topics: ["maize", "tomato", "soil", "livestock", "research"] },
  { name: "FAO Kenya",                      url: "https://www.fao.org",           topics: ["food security", "irrigation", "pest", "fish", "climate"] },
  { name: "ICIPE",                          url: "https://www.icipe.org",         topics: ["pest", "insect", "armyworm", "bee", "beekeeping"] },
  { name: "ILRI",                           url: "https://www.ilri.org",          topics: ["livestock", "dairy", "cattle", "poultry", "sheep"] },
  { name: "WorldFish",                      url: "https://worldfishcenter.org",   topics: ["fish", "aquaculture", "tilapia", "pond"] },
  { name: "Kenya Meteorological Department", url: "https://meteo.go.ke",         topics: ["weather", "rain", "season", "forecast", "climate"] },
];

/** Match trusted resources to a query based on keyword overlap */
function matchResources(query: string, retrieved: CorpusEntry[]): TrustedResource[] {
  const q = query.toLowerCase();
  // Collect topic words from the query and retrieved guidance titles
  const topicWords = [
    ...q.split(/\s+/),
    ...retrieved.flatMap((e) => e.guidance.title.toLowerCase().split(/\s+/)),
  ];
  return TRUSTED_RESOURCES.filter((r) =>
    r.topics.some((t) => topicWords.some((w) => w.includes(t) || t.includes(w)))
  ).slice(0, 2);
}

// ─── Public Types ─────────────────────────────────────────────────────────────

export type ConfidenceLevel = "high" | "medium" | "low";
export type AISource        = "huggingface" | "fallback";

export interface ImagePrediction {
  label: string;
  score: number;
  advice?: string;
}

export interface AIResponse {
  message: string;
  confidence: ConfidenceLevel;
  nextSteps: string[];
  source: AISource;
  model?: string;
  predictions?: ImagePrediction[];
  resources?: TrustedResource[];
  weatherSummary?: string;
  /** Present on fallback responses for rich GuidanceCard rendering */
  guidance?: GuidanceResponse;
}

export interface FarmingContext {
  cropType?: string;
  livestockType?: string;
  location?: string;
  season?: string;
  mode?: AssistantMode;
  farmActivities?: string[];
}

// ─── Response Cache ───────────────────────────────────────────────────────────

interface CacheEntry { response: AIResponse; expiresAt: number; }
const _cache = new Map<string, CacheEntry>();

function buildCacheKey(query: string, location: string, mode: string): string {
  const raw = `${query.toLowerCase().trim()}|${location}|${mode}`;
  return btoa(encodeURIComponent(raw)).slice(0, 64);
}

function getCached(key: string): AIResponse | null {
  const m = _cache.get(key);
  if (m && Date.now() < m.expiresAt) return { ...m.response };
  if (m) _cache.delete(key);
  // Try localStorage
  try {
    const raw = localStorage.getItem(`harvest_ai_${key}`);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() > entry.expiresAt) { localStorage.removeItem(`harvest_ai_${key}`); return null; }
    return { ...entry.response };
  } catch { return null; }
}

function setCached(key: string, response: AIResponse): void {
  const entry = { response, expiresAt: Date.now() + RESPONSE_CACHE_TTL };
  _cache.set(key, entry);
  try { localStorage.setItem(`harvest_ai_${key}`, JSON.stringify(entry)); } catch { /* quota */ }
}

export function clearAICache(): void {
  _cache.clear();
  clearEmbeddingCache();
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("harvest_ai_") || key.startsWith("harvest_emb_")) {
      localStorage.removeItem(key);
    }
  }
}

// ─── Shared Helpers ───────────────────────────────────────────────────────────

function getApiKey(): string {
  return import.meta.env.VITE_HF_API_KEY ?? "";
}

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function getCurrentSeason(): string {
  const m = new Date().getMonth() + 1;
  if (m >= 3 && m <= 5)   return "long rains season (March–May)";
  if (m >= 10 && m <= 12) return "short rains season (October–December)";
  return "dry season";
}

// ─── Structured Prompt Builder ────────────────────────────────────────────────

/**
 * Parsed structure we expect from Mistral-7B.
 * The model is instructed to return only this JSON.
 */
interface ParsedHFResponse {
  answer:      string;
  explanation: string;
  steps:       string[];
  tips?:       string[];
  confidence?: "high" | "medium" | "low";
}

function buildRAGPrompt(
  query: string,
  retrieved: CorpusEntry[],
  weatherSummary: string,
  farmingCtx: FarmingContext,
  mode: AssistantMode,
  isRetry: boolean
): string {
  const modeGuide =
    mode === "diagnosis" ? "Identify the exact problem, its likely cause, and immediate steps to fix it." :
    mode === "planning"  ? "Give timing, scheduling, and resource planning steps." :
                           "Give practical farming best practices and actionable advice.";

  const contextLine = [
    farmingCtx.cropType       && `growing ${farmingCtx.cropType}`,
    farmingCtx.livestockType  && `raising ${farmingCtx.livestockType}`,
    farmingCtx.location       && `based in ${farmingCtx.location}`,
    farmingCtx.farmActivities?.length && `farm activities: ${farmingCtx.farmActivities.slice(0, 3).join(", ")}`,
  ].filter(Boolean).join("; ") || "smallholder farmer in Kenya";

  const retrievedBlock = retrieved.length
    ? retrieved.map((e) => `### ${e.guidance.title}\n${e.guidance.summary}\nKey points: ${e.guidance.sections[0]?.points.slice(0, 3).join(" | ")}`).join("\n\n")
    : "No specific knowledge retrieved — use your general East Africa agricultural knowledge.";

  const retryNote = isRetry
    ? "\n⚠️ IMPORTANT: Your previous answer was too short or lacked actionable steps. This is a RETRY — give at least 3 concrete, numbered steps and a clear explanation.\n"
    : "";

  const trustedUrlsLine = TRUSTED_RESOURCES.map((r) => `${r.url} (${r.name})`).join(", ");

  return `[INST] You are Harvest AI, a practical agricultural advisor for Kenyan and East African smallholder farmers.
${retryNote}
FARMER CONTEXT: ${contextLine}
WEATHER & SEASON: ${weatherSummary || getCurrentSeason()}

VERIFIED KNOWLEDGE BASE (use this to ground your answer):
${retrievedBlock}

TASK: ${modeGuide}

RULES:
- Use simple, plain English — no jargon
- Be specific to Kenya/East Africa (mention KALRO, Kenya Seed Company, county offices where relevant)
- Provide ONLY practical, actionable advice
- External links ONLY from: ${trustedUrlsLine}
- Do NOT add greetings, sign-offs, or disclaimers

Respond with ONLY valid JSON in this exact format (no other text, no markdown fences):
{
  "answer": "One clear sentence answering the question directly",
  "explanation": "2-3 sentences explaining why, in simple terms",
  "steps": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
  "tips": ["Optional practical tip"],
  "confidence": "high or medium or low based on how certain you are"
}

FARMER QUESTION: ${query} [/INST]`;
}

// ─── Response Validation ──────────────────────────────────────────────────────

function isValidParsed(p: ParsedHFResponse): boolean {
  return (
    typeof p.answer === "string" && p.answer.trim().length >= 30 &&
    typeof p.explanation === "string" && p.explanation.trim().length >= 20 &&
    Array.isArray(p.steps) && p.steps.length >= 2 &&
    p.steps.every((s) => typeof s === "string" && s.trim().length > 5)
  );
}

function tryParseJSON(raw: string): ParsedHFResponse | null {
  // Strip markdown fences if model wraps in ```json
  const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(stripped) as ParsedHFResponse; } catch { /* ignore */ }
  // Try extracting first {...} block
  const match = stripped.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]) as ParsedHFResponse; } catch { /* ignore */ }
  }
  return null;
}

function scoreConfidence(
  parsed: ParsedHFResponse,
  retrieved: CorpusEntry[]
): ConfidenceLevel {
  if (parsed.confidence === "high" && retrieved.length >= 2) return "high";
  if (parsed.confidence === "low"  || parsed.steps.length < 2) return "low";
  // Check for Kenya-specific signals in the response
  const combined = `${parsed.answer} ${parsed.explanation} ${parsed.steps.join(" ")}`.toLowerCase();
  const kenyaSignals = ["kenya", "kalro", "nairobi", "fertilizer", "season", "acre", "maize", "extension"];
  const hits = kenyaSignals.filter((s) => combined.includes(s)).length;
  if (hits >= 2 && parsed.steps.length >= 3) return "high";
  return "medium";
}

// ─── HuggingFace Text API ─────────────────────────────────────────────────────

async function callHFChat(prompt: string, maxTokens = 600): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("VITE_HF_API_KEY not configured");

  const res = await fetchWithTimeout(`${HF_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      Authorization:   `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model:       MODELS.text,
      messages:    [{ role: "user", content: prompt }],
      max_tokens:  maxTokens,
      temperature: 0.35,
      stream:      false,
    }),
  });

  if (res.status === 503) {
    const body = await res.json().catch(() => ({})) as { estimated_time?: number };
    throw new Error(`Model loading (${body.estimated_time ? Math.ceil(body.estimated_time) + "s" : "~20s"})`);
  }
  if (!res.ok) throw new Error(`HF text API ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty response from HF API");
  return content;
}

/**
 * Call HF with validation + one retry on weak responses.
 */
async function callHFWithRetry(
  query: string,
  retrieved: CorpusEntry[],
  weatherSummary: string,
  farmingCtx: FarmingContext,
  mode: AssistantMode
): Promise<{ parsed: ParsedHFResponse; wasRetry: boolean }> {
  // First attempt
  const prompt1 = buildRAGPrompt(query, retrieved, weatherSummary, farmingCtx, mode, false);
  const raw1    = await callHFChat(prompt1);
  const parsed1 = tryParseJSON(raw1);

  if (parsed1 && isValidParsed(parsed1)) {
    return { parsed: parsed1, wasRetry: false };
  }

  console.warn("[aiService] First attempt invalid, retrying with stronger prompt");

  // Retry with more context + explicit reminder
  const prompt2 = buildRAGPrompt(query, retrieved, weatherSummary, farmingCtx, mode, true);
  const raw2    = await callHFChat(prompt2, 700);
  const parsed2 = tryParseJSON(raw2);

  if (parsed2 && isValidParsed(parsed2)) {
    return { parsed: parsed2, wasRetry: true };
  }

  // If retry also failed, try to salvage whatever we got
  const best = parsed2 ?? parsed1;
  if (best) {
    // Patch missing fields to pass validation
    best.steps       = best.steps?.length ? best.steps : ["Consult your local agricultural extension officer.", "Contact KALRO for expert guidance."];
    best.explanation = best.explanation?.length ? best.explanation : best.answer;
    return { parsed: best, wasRetry: true };
  }

  throw new Error("Both HF attempts returned unparseable responses");
}

// ─── Smart Fallback ───────────────────────────────────────────────────────────

/**
 * Build a structured fallback response from retrieved knowledge entries.
 * Never returns raw/generic text — always uses RAG-retrieved content.
 */
function buildSmartFallback(
  query: string,
  retrieved: CorpusEntry[],
  mode: AssistantMode,
  resources: TrustedResource[]
): AIResponse {
  // Use the best matching retrieved entry, or fall back to getGuidance
  const topEntry = retrieved[0];
  const guidance = topEntry?.guidance ?? getGuidance(query, mode);

  const allPoints = guidance.sections.flatMap((s) => s.points);

  return {
    message:    guidance.summary,
    confidence: retrieved.length >= 2 ? "medium" : "low",
    nextSteps:  allPoints.slice(0, 5),
    source:     "fallback",
    resources,
    guidance,
  };
}

// ─── Primary Text Query ───────────────────────────────────────────────────────

/**
 * Main public function: RAG-powered farming advice / diagnosis / planning.
 */
export async function queryAI(
  query: string,
  context?: FarmingContext,
  mode: AssistantMode = "advice"
): Promise<AIResponse> {
  const apiKey   = getApiKey();
  const location = context?.location ?? "Kenya";
  const cacheKey = buildCacheKey(query, location, mode);

  // 1. Cache check
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // 2. Parallel: fetch weather + retrieve knowledge (both non-blocking)
  const corpus = getKnowledgeCorpus();
  let retrieved: CorpusEntry[] = [];
  let weatherCtx = "";

  try {
    const [weather, topEntries] = await Promise.allSettled([
      getWeatherContext(),
      apiKey ? retrieveTopK(query, corpus, apiKey, 3) : Promise.reject("no key"),
    ]);

    if (weather.status === "fulfilled" && weather.value) {
      weatherCtx = weatherToPromptString(weather.value);
    }
    if (topEntries.status === "fulfilled") {
      retrieved = topEntries.value;
    } else {
      // Keyword fallback retrieval when embedding is unavailable
      const q = query.toLowerCase();
      retrieved = corpus.filter((e) =>
        e.text.toLowerCase().split(/\W+/).some((w) => w.length > 3 && q.includes(w))
      ).slice(0, 3);
    }
  } catch { /* non-fatal — proceed with empty retrieved */ }

  const resources = matchResources(query, retrieved);

  // 3. Try HuggingFace
  if (apiKey) {
    try {
      const { parsed, wasRetry } = await callHFWithRetry(
        query, retrieved, weatherCtx, context ?? {}, mode
      );

      const response: AIResponse = {
        message:        `${parsed.answer}\n\n${parsed.explanation}`.trim(),
        confidence:     scoreConfidence(parsed, retrieved),
        nextSteps:      parsed.steps,
        source:         "huggingface",
        model:          MODELS.text,
        resources,
        weatherSummary: weatherCtx || undefined,
      };

      if (wasRetry) response.confidence = response.confidence === "high" ? "medium" : response.confidence;

      setCached(cacheKey, response);
      return response;
    } catch (err) {
      console.warn("[aiService] HF text failed:", (err as Error).message);
    }
  }

  // 4. Smart fallback
  return buildSmartFallback(query, retrieved, mode, resources);
}

// ─── Image Inference ──────────────────────────────────────────────────────────

function labelToAdvice(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("healthy") || l.includes("normal"))
    return "Your crop appears healthy. Maintain current care routines and scout regularly.";
  if (l.includes("blight"))
    return "Blight detected. Remove affected leaves immediately and apply copper-based fungicide.";
  if (l.includes("rust"))
    return "Rust infection suspected. Apply mancozeb or sulfur-based fungicide and improve air circulation.";
  if (l.includes("spot") || l.includes("cercospora"))
    return "Leaf spot disease suspected. Switch to drip irrigation and apply registered fungicide.";
  if (l.includes("mildew"))
    return "Powdery/downy mildew detected. Apply potassium bicarbonate or sulfur-based spray.";
  if (l.includes("wilt"))
    return "Wilting detected. Check for fusarium or bacterial wilt — cut stem to check for browning.";
  if (l.includes("mosaic") || l.includes("virus"))
    return "Possible viral infection. Remove affected plants and control aphid/whitefly vectors.";
  if (l.includes("armyworm") || l.includes("caterpillar") || l.includes("insect"))
    return "Pest infestation suspected. Scout fields and apply pesticide if threshold exceeded.";
  if (l.includes("deficiency") || l.includes("chlorosis") || l.includes("yellow"))
    return "Nutrient deficiency possible. Test soil and apply nitrogen or balanced fertilizer.";
  if (l.includes("drought") || l.includes("dry") || l.includes("stress"))
    return "Drought stress detected. Mulch around plants and schedule irrigation.";
  return "Condition unclear. Consult your local agricultural extension officer for on-site assessment.";
}

async function fileToBinary(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsArrayBuffer(file);
  });
}

async function callHFImage(
  file: File,
  modelId: string
): Promise<{ label: string; score: number }[]> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("VITE_HF_API_KEY not configured");

  const binary = await fileToBinary(file);

  const res = await fetchWithTimeout(`${HF_BASE}/models/${modelId}`, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "image/jpeg",
      Authorization:  `Bearer ${apiKey}`,
    },
    body: binary,
  });

  if (res.status === 503) throw new Error("Image model loading — retry in 20s");
  if (!res.ok) throw new Error(`HF image API ${res.status}`);

  const data = await res.json() as unknown;
  if (!Array.isArray(data) || !(data as {label?:string}[])[0]?.label)
    throw new Error("Unexpected image response format");
  return (data as { label: string; score: number }[]).slice(0, 5);
}

/**
 * Use the text model to generate a user-friendly interpretation of image predictions.
 * Only called when the classification model returns valid results.
 */
async function interpretPredictionsWithAI(
  predictions: ImagePrediction[],
  context?: FarmingContext
): Promise<string | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const topPrediction = predictions[0];
  const subject = context?.cropType || context?.livestockType || "the crop in the image";
  const predsList = predictions.slice(0, 3)
    .map((p) => `${p.label} (${Math.round(p.score * 100)}% confidence)`)
    .join(", ");

  const prompt = `[INST] You are a plant disease expert for Kenyan farmers. An image classifier detected these conditions in ${subject}: ${predsList}.

Write a brief, practical interpretation in 2-3 sentences using simple language. Mention the most likely condition and one immediate action the farmer should take. Do NOT start with "I" or greetings. [/INST]`;

  try {
    const raw = await callHFChat(prompt, 200);
    return raw.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Analyze an uploaded farm image for disease, pest, or condition assessment.
 * Enforces a confidence threshold of 0.60 — returns "unclear image" below it.
 */
export async function analyzeImage(
  imageFile: File,
  context?: FarmingContext
): Promise<AIResponse> {
  const resources = TRUSTED_RESOURCES.filter((r) =>
    r.topics.includes("pest") || r.topics.includes("research")
  ).slice(0, 2);

  // Try plant-disease model, then general vision model
  for (const modelId of [MODELS.plantDisease, MODELS.image]) {
    try {
      const raw = await callHFImage(imageFile, modelId);

      const predictions: ImagePrediction[] = raw.map((p) => ({
        label:  p.label,
        score:  Math.round(p.score * 100) / 100,
        advice: labelToAdvice(p.label),
      }));

      const topScore = predictions[0]?.score ?? 0;

      // ─── Confidence threshold: reject unclear images ─────────────
      if (topScore < IMAGE_CONFIDENCE_MIN) {
        return {
          message:    "The image is unclear or the model isn't confident enough to make a diagnosis. Please take a closer, well-lit photo of the affected area.",
          confidence: "low",
          nextSteps:  [
            "Take a close-up photo of the affected leaf, stem, or animal part.",
            "Ensure good lighting — natural daylight works best.",
            "Avoid blurry or shadowy images.",
            "Try photographing just one clearly affected area rather than the whole plant.",
            "If the problem persists, contact your local extension officer for an on-site visit.",
          ],
          source:    "huggingface",
          model:     modelId,
          resources,
          predictions,
        };
      }

      // Get AI-generated interpretation of the predictions
      const aiInterpretation = await interpretPredictionsWithAI(predictions, context);

      const topLabel   = predictions[0].label;
      const topAdvice  = predictions[0].advice ?? "";
      const subject    = context?.cropType || context?.livestockType || "your crop";
      const confLabel  = topScore >= 0.80 ? "high confidence" : "moderate confidence";

      const message = aiInterpretation
        ?? `Analysis of your ${subject} image (${confLabel}): The model identified "${topLabel}" as the most likely condition. ${topAdvice}`;

      return {
        message,
        confidence: topScore >= 0.80 ? "high" : "medium",
        nextSteps:  [
          topAdvice,
          "Record when symptoms first appeared and which plants are affected.",
          "Isolate affected plants immediately to prevent spread.",
          "Take samples to your nearest agricultural extension office.",
          "Contact KALRO or Kenya Plant Health Inspectorate (KEPHIS) for expert confirmation.",
        ].filter((s) => s.length > 5).slice(0, 5),
        source:    "huggingface",
        model:     modelId,
        resources,
        predictions,
      };
    } catch (err) {
      console.warn(`[aiService] Image model ${modelId} failed:`, (err as Error).message);
    }
  }

  // Fallback: text-based guidance
  const corpus    = getKnowledgeCorpus();
  const apiKey    = getApiKey();
  const retrieved = apiKey
    ? await retrieveTopK("crop disease pest diagnosis", corpus, apiKey, 2).catch(() => corpus.slice(0, 2))
    : corpus.slice(0, 2);

  const fallback = buildSmartFallback("crop disease or pest", retrieved, "diagnosis", resources);
  return {
    ...fallback,
    confidence: "low",
    predictions: [],
    message: `Image analysis is temporarily unavailable. ${fallback.message}`,
  };
}

// ─── Activity-Specific Advice ─────────────────────────────────────────────────

/**
 * Get targeted advice for a specific farm activity.
 * Used when the user taps an activity chip in FarmAssistant.
 */
export async function queryActivityAdvice(
  activityName: string,
  activityType: string,
  context?: FarmingContext
): Promise<AIResponse> {
  const enriched: FarmingContext = {
    ...context,
    cropType:      ["crop", "aquaculture"].includes(activityType) ? activityName : context?.cropType,
    livestockType: ["livestock", "poultry", "beekeeping"].includes(activityType) ? activityName : context?.livestockType,
  };
  return queryAI(
    `What are the current best practices and upcoming tasks for my ${activityName} (${activityType})?`,
    enriched,
    "advice"
  );
}
