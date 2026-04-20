/**
 * Harvest AI Service — RAG-Powered Agricultural Advisor
 * ──────────────────────────────────────────────────────────────────
 * Architecture:
 *  1. RETRIEVE  — embed user query, find top-3 semantically similar
 *                 entries from the local knowledge base (RAG)
 *  2. GENERATE  — inject retrieved knowledge + weather context into
 *                 a structured prompt sent to Mistral-7B via backend
 *  3. VALIDATE  — verify response quality; retry once if weak
 *  4. FALLBACK  — if backend fails, build a structured response from
 *                 retrieved knowledge (never returns raw text)
 *
 * All AI model calls are routed through the Supabase Edge Function
 * ai-gateway. NO API keys are used or stored in the frontend.
 */

import { getGuidance, getKnowledgeCorpus } from "@/lib/agricultureKnowledge";
import type { GuidanceResponse, AssistantMode, CorpusEntry } from "@/lib/agricultureKnowledge";
import { retrieveTopK, clearEmbeddingCache } from "@/services/embeddingService";
import { getWeatherContext, weatherToPromptString } from "@/services/weatherService";
import { fetchAgriNews, newsToPromptString } from "@/services/newsService";
import { supabase } from "@/services/supabaseClient";

// ─── Model names (for display / logging only — actual calls go through backend) ─

const MODELS = {
  text:         "mistralai/Mistral-7B-Instruct-v0.3",
  image:        "google/vit-base-patch16-224",
  plantDisease: "linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification",
} as const;

const RESPONSE_CACHE_TTL   = 5 * 60 * 1000;  // 5 minutes
const IMAGE_CONFIDENCE_MIN = 0.60;

// ─── Warm-up status emitter ───────────────────────────────────────────────────
// The HF Inference API often returns 503 `model_loading` on cold starts. We
// transparently retry with exponential backoff and broadcast a status event so
// the UI can show "Model warming up — retrying in ~Ns" instead of an error.

export type AIStatus =
  | { kind: "warming"; retryInSec: number; attempt: number; maxAttempts: number }
  | { kind: "ready" };

type StatusListener = (s: AIStatus) => void;
const statusListeners = new Set<StatusListener>();

export function subscribeAIStatus(fn: StatusListener): () => void {
  statusListeners.add(fn);
  return () => { statusListeners.delete(fn); };
}

function emitStatus(s: AIStatus): void {
  statusListeners.forEach((fn) => { try { fn(s); } catch { /* listener error — ignore */ } });
}

const MAX_WARMUP_RETRIES = 3;
const MAX_WARMUP_WAIT_SEC = 30;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ─── Backend API Helpers ──────────────────────────────────────────────────────

async function callBackendText(prompt: string, maxTokens = 600, temperature = 0.35): Promise<string> {
  for (let attempt = 1; attempt <= MAX_WARMUP_RETRIES + 1; attempt++) {
    const { data, error } = await supabase.functions.invoke("ai-gateway/text", {
      body: { prompt, maxTokens, temperature },
    });
    if (error) throw new Error(`AI gateway error: ${error.message}`);

    if (data?.error === "model_loading") {
      if (attempt > MAX_WARMUP_RETRIES) {
        emitStatus({ kind: "ready" });
        throw new Error(`Model still loading after ${MAX_WARMUP_RETRIES} retries`);
      }
      const hinted = Number(data.estimated_time) || 20;
      // Exponential backoff capped at MAX_WARMUP_WAIT_SEC
      const waitSec = Math.min(MAX_WARMUP_WAIT_SEC, Math.max(5, Math.ceil(hinted * Math.pow(1.5, attempt - 1))));
      emitStatus({ kind: "warming", retryInSec: waitSec, attempt, maxAttempts: MAX_WARMUP_RETRIES });
      await sleep(waitSec * 1000);
      continue;
    }

    if (data?.error) {
      emitStatus({ kind: "ready" });
      throw new Error(`AI backend: ${data.error}`);
    }
    if (!data?.content) {
      emitStatus({ kind: "ready" });
      throw new Error("Empty response from AI backend");
    }
    emitStatus({ kind: "ready" });
    return data.content;
  }
  emitStatus({ kind: "ready" });
  throw new Error("AI backend exhausted retries");
}

async function callBackendImage(
  file: File
): Promise<{ label: string; score: number }[]> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const imageBase64 = btoa(String.fromCharCode(...bytes));

  for (let attempt = 1; attempt <= MAX_WARMUP_RETRIES + 1; attempt++) {
    const { data, error } = await supabase.functions.invoke("ai-gateway/image", {
      body: { imageBase64, contentType: file.type || "image/jpeg" },
    });
    if (error) throw new Error(`AI gateway image error: ${error.message}`);

    if (data?.error === "model_loading") {
      if (attempt > MAX_WARMUP_RETRIES) {
        emitStatus({ kind: "ready" });
        throw new Error(`Image model still loading after ${MAX_WARMUP_RETRIES} retries`);
      }
      const hinted = Number(data.estimated_time) || 20;
      const waitSec = Math.min(MAX_WARMUP_WAIT_SEC, Math.max(5, Math.ceil(hinted * Math.pow(1.5, attempt - 1))));
      emitStatus({ kind: "warming", retryInSec: waitSec, attempt, maxAttempts: MAX_WARMUP_RETRIES });
      await sleep(waitSec * 1000);
      continue;
    }

    if (data?.error) {
      emitStatus({ kind: "ready" });
      throw new Error(`AI image backend: ${data.error}`);
    }
    if (!data?.predictions) {
      emitStatus({ kind: "ready" });
      throw new Error("No predictions from backend");
    }
    emitStatus({ kind: "ready" });
    return data.predictions;
  }
  emitStatus({ kind: "ready" });
  throw new Error("AI image backend exhausted retries");
}

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

function matchResources(query: string, retrieved: CorpusEntry[]): TrustedResource[] {
  const q = query.toLowerCase();
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
  guidance?: GuidanceResponse;
}

export interface FarmingContext {
  cropType?: string;
  livestockType?: string;
  location?: string;
  season?: string;
  mode?: AssistantMode;
  farmActivities?: string[];
  /** Optional rich, multi-line summary of the farmer's actual activities,
   *  upcoming tasks and recent records. Injected verbatim into the prompt
   *  so AI advice can reference the farmer's real situation. */
  farmContextSummary?: string;
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

function getCurrentSeason(): string {
  const m = new Date().getMonth() + 1;
  if (m >= 3 && m <= 5)   return "long rains season (March–May)";
  if (m >= 10 && m <= 12) return "short rains season (October–December)";
  return "dry season";
}

// ─── Structured Prompt Builder ────────────────────────────────────────────────

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
  newsSummary: string,
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

  const farmDetailsBlock = farmingCtx.farmContextSummary
    ? `\nFARMER'S CURRENT OPERATIONS (use this to make advice specific):\n${farmingCtx.farmContextSummary}\n`
    : "";

  const retrievedBlock = retrieved.length
    ? retrieved.map((e) => `### ${e.guidance.title}\n${e.guidance.summary}\nKey points: ${e.guidance.sections[0]?.points.slice(0, 3).join(" | ")}`).join("\n\n")
    : "No specific knowledge retrieved — use your general East Africa agricultural knowledge.";

  const retryNote = isRetry
    ? "\n⚠️ IMPORTANT: Your previous answer was too short or lacked actionable steps. This is a RETRY — give at least 3 concrete, numbered steps and a clear explanation.\n"
    : "";

  const trustedUrlsLine = TRUSTED_RESOURCES.map((r) => `${r.url} (${r.name})`).join(", ");

  const newsBlock = newsSummary
    ? `\nRECENT VERIFIED NEWS (reference only if relevant to the question):\n${newsSummary}\n`
    : "";

  return `[INST] You are Harvest AI, a practical agricultural advisor for Kenyan and East African smallholder farmers.
${retryNote}
FARMER CONTEXT: ${contextLine}
WEATHER & SEASON: ${weatherSummary || getCurrentSeason()}
${farmDetailsBlock}${newsBlock}
VERIFIED KNOWLEDGE BASE (use this to ground your answer):
${retrievedBlock}

TASK: ${modeGuide}

RULES:
- Use simple, plain English — no jargon
- Be specific to Kenya/East Africa (mention KALRO, Kenya Seed Company, county offices where relevant)
- Provide ONLY practical, actionable advice
- Reference weather conditions if they affect timing (planting, irrigation, spraying, pest risk)
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
  const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(stripped) as ParsedHFResponse; } catch { /* ignore */ }
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
  const combined = `${parsed.answer} ${parsed.explanation} ${parsed.steps.join(" ")}`.toLowerCase();
  const kenyaSignals = ["kenya", "kalro", "nairobi", "fertilizer", "season", "acre", "maize", "extension"];
  const hits = kenyaSignals.filter((s) => combined.includes(s)).length;
  if (hits >= 2 && parsed.steps.length >= 3) return "high";
  return "medium";
}

// ─── Backend Text API (with retry) ────────────────────────────────────────────

async function callTextWithRetry(
  query: string,
  retrieved: CorpusEntry[],
  weatherSummary: string,
  newsSummary: string,
  farmingCtx: FarmingContext,
  mode: AssistantMode
): Promise<{ parsed: ParsedHFResponse; wasRetry: boolean }> {
  const prompt1 = buildRAGPrompt(query, retrieved, weatherSummary, newsSummary, farmingCtx, mode, false);
  const raw1    = await callBackendText(prompt1);
  const parsed1 = tryParseJSON(raw1);

  if (parsed1 && isValidParsed(parsed1)) {
    return { parsed: parsed1, wasRetry: false };
  }

  console.warn("[aiService] First attempt invalid, retrying with stronger prompt");

  const prompt2 = buildRAGPrompt(query, retrieved, weatherSummary, newsSummary, farmingCtx, mode, true);
  const raw2    = await callBackendText(prompt2, 700);
  const parsed2 = tryParseJSON(raw2);

  if (parsed2 && isValidParsed(parsed2)) {
    return { parsed: parsed2, wasRetry: true };
  }

  const best = parsed2 ?? parsed1;
  if (best) {
    best.steps       = best.steps?.length ? best.steps : ["Consult your local agricultural extension officer.", "Contact KALRO for expert guidance."];
    best.explanation = best.explanation?.length ? best.explanation : best.answer;
    return { parsed: best, wasRetry: true };
  }

  throw new Error("Both attempts returned unparseable responses");
}

// ─── Smart Fallback ───────────────────────────────────────────────────────────

function buildSmartFallback(
  query: string,
  retrieved: CorpusEntry[],
  mode: AssistantMode,
  resources: TrustedResource[]
): AIResponse {
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

export async function queryAI(
  query: string,
  context?: FarmingContext,
  mode: AssistantMode = "advice"
): Promise<AIResponse> {
  const location = context?.location ?? "Kenya";
  const cacheKey = buildCacheKey(query, location, mode);

  // 1. Cache check
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // 2. Parallel: fetch weather + news + retrieve knowledge
  const corpus = getKnowledgeCorpus();
  let retrieved: CorpusEntry[] = [];
  let weatherCtx = "";
  let newsCtx    = "";
  let resolvedLocation = context?.location;
  let resolvedCountry: string | undefined;

  try {
    const [weather, topEntries] = await Promise.allSettled([
      getWeatherContext(),
      retrieveTopK(query, corpus, 3),
    ]);

    if (weather.status === "fulfilled" && weather.value) {
      weatherCtx       = weatherToPromptString(weather.value);
      resolvedLocation = resolvedLocation || weather.value.location;
      resolvedCountry  = weather.value.country;
    }
    if (topEntries.status === "fulfilled") {
      retrieved = topEntries.value;
    } else {
      const q = query.toLowerCase();
      retrieved = corpus.filter((e) =>
        e.text.toLowerCase().split(/\W+/).some((w) => w.length > 3 && q.includes(w))
      ).slice(0, 3);
    }
  } catch { /* non-fatal */ }

  // News fetch is independent and best-effort — never blocks AI on failure.
  try {
    const articles = await fetchAgriNews({
      location: resolvedLocation,
      country:  resolvedCountry ?? "Kenya",
      query,
      limit:    5,
    });
    newsCtx = newsToPromptString(articles, 3);
  } catch { /* non-fatal */ }

  const resources = matchResources(query, retrieved);

  // 3. Try backend AI
  try {
    const { parsed, wasRetry } = await callTextWithRetry(
      query, retrieved, weatherCtx, newsCtx, context ?? {}, mode
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
    console.warn("[aiService] Backend text failed:", (err as Error).message);
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

async function interpretPredictionsWithAI(
  predictions: ImagePrediction[],
  context?: FarmingContext
): Promise<string | null> {
  const topPrediction = predictions[0];
  const subject = context?.cropType || context?.livestockType || "the crop in the image";
  const predsList = predictions.slice(0, 3)
    .map((p) => `${p.label} (${Math.round(p.score * 100)}% confidence)`)
    .join(", ");

  const prompt = `[INST] You are a plant disease expert for Kenyan farmers. An image classifier detected these conditions in ${subject}: ${predsList}.

Write a brief, practical interpretation in 2-3 sentences using simple language. Mention the most likely condition and one immediate action the farmer should take. Do NOT start with "I" or greetings. [/INST]`;

  try {
    const raw = await callBackendText(prompt, 200);
    return raw.trim() || null;
  } catch {
    return null;
  }
}

export async function analyzeImage(
  imageFile: File,
  context?: FarmingContext
): Promise<AIResponse> {
  const resources = TRUSTED_RESOURCES.filter((r) =>
    r.topics.includes("pest") || r.topics.includes("research")
  ).slice(0, 2);

  try {
    const raw = await callBackendImage(imageFile);

    const predictions: ImagePrediction[] = raw.map((p) => ({
      label:  p.label,
      score:  Math.round(p.score * 100) / 100,
      advice: labelToAdvice(p.label),
    }));

    const topScore = predictions[0]?.score ?? 0;

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
        model:     MODELS.plantDisease,
        resources,
        predictions,
      };
    }

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
      model:     MODELS.plantDisease,
      resources,
      predictions,
    };
  } catch (err) {
    console.warn("[aiService] Image analysis failed:", (err as Error).message);
  }

  // Fallback: text-based guidance
  const corpus    = getKnowledgeCorpus();
  const retrieved = await retrieveTopK("crop disease pest diagnosis", corpus, 2).catch(() => corpus.slice(0, 2));

  const fallback = buildSmartFallback("crop disease or pest", retrieved, "diagnosis", resources);
  return {
    ...fallback,
    confidence: "low",
    predictions: [],
    message: `Image analysis is temporarily unavailable. ${fallback.message}`,
  };
}

// ─── Activity-Specific Advice ─────────────────────────────────────────────────

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
