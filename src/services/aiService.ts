import {
  getGuidance,
  type AssistantMode,
  type GuidanceResponse,
} from "@/lib/agricultureKnowledge";
import type { FarmRecord } from "@/services/farmService";

// ─── UNIFIED RESPONSE CONTRACT ────────────────────────

export interface AIDiagnosis {
  issue: string;
  confidence: number;
  severity: "low" | "medium" | "high";
}

export interface AIAction {
  title: string;
  priority: "low" | "medium" | "high";
}

export interface AIAlert {
  level: "low" | "medium" | "high";
  message: string;
}

export interface NormalizedAIResponse {
  summary: string;
  diagnosis?: AIDiagnosis;
  actions: AIAction[];
  alerts: AIAlert[];
  followUpQuestions: string[];
  source: "knowledge-base" | "ai-model";
  confidence?: number;
  // Legacy compat fields
  content: string;
  guidance?: GuidanceResponse;
}

// ─── REQUEST TYPE ─────────────────────────────────────

export interface AIRequest {
  mode: AssistantMode | "general";
  query: string;
  farmRecords?: FarmRecord[];
}

// ─── CONFIG ───────────────────────────────────────────

const endpoint = import.meta.env.VITE_AI_ENDPOINT;
const apiKey = import.meta.env.VITE_AI_API_KEY;
const model = import.meta.env.VITE_AI_MODEL;
const TIMEOUT = 20000;

// ─── NORMALIZATION GATEWAY ────────────────────────────

export function normalizeAIResponse(
  raw: unknown,
  source: "ai-model" | "knowledge-base" = "ai-model"
): NormalizedAIResponse {
  // Default empty response
  const base: NormalizedAIResponse = {
    summary: "",
    actions: [],
    alerts: [],
    followUpQuestions: [],
    source,
    content: "",
  };

  if (!raw || typeof raw !== "object") {
    // Raw is plain text or null
    const text = typeof raw === "string" ? raw : "";
    base.summary = text;
    base.content = text;
    return base;
  }

  const obj = raw as Record<string, unknown>;

  // Extract summary/content
  const summary =
    typeof obj.content === "string"
      ? obj.content
      : typeof obj.summary === "string"
        ? obj.summary
        : typeof obj.diagnosis === "string"
          ? obj.diagnosis
          : typeof obj.response === "string"
            ? obj.response
            : JSON.stringify(obj);

  base.summary = summary;
  base.content = summary;

  // Extract diagnosis
  if (obj.diagnosis && typeof obj.diagnosis === "object") {
    const d = obj.diagnosis as Record<string, unknown>;
    base.diagnosis = {
      issue: typeof d.issue === "string" ? d.issue : String(d.issue ?? summary),
      confidence: typeof d.confidence === "number" ? d.confidence : 0.5,
      severity: validateSeverity(d.severity),
    };
  } else if (typeof obj.confidence === "number" && typeof obj.severity === "string") {
    base.diagnosis = {
      issue: summary,
      confidence: obj.confidence as number,
      severity: validateSeverity(obj.severity),
    };
  }

  // Extract actions
  if (Array.isArray(obj.actions)) {
    base.actions = obj.actions
      .filter((a): a is Record<string, unknown> => !!a && typeof a === "object")
      .map((a) => ({
        title: typeof a.title === "string" ? a.title : String(a),
        priority: validatePriority(a.priority),
      }));
  }

  // Extract alerts
  if (Array.isArray(obj.alerts)) {
    base.alerts = obj.alerts
      .filter((a): a is Record<string, unknown> => !!a && typeof a === "object")
      .map((a) => ({
        level: validateSeverity(a.level ?? a.severity),
        message: typeof a.message === "string" ? a.message : String(a),
      }));
  }

  // Extract follow-up questions
  if (Array.isArray(obj.followUpQuestions)) {
    base.followUpQuestions = obj.followUpQuestions.filter(
      (q): q is string => typeof q === "string"
    );
  }

  // Confidence
  if (typeof obj.confidence === "number") {
    base.confidence = obj.confidence;
  }

  // Guidance passthrough
  if (obj.guidance) {
    base.guidance = obj.guidance as GuidanceResponse;
  }

  // Source passthrough
  if (obj.source === "knowledge-base" || obj.source === "ai-model") {
    base.source = obj.source;
  }

  return base;
}

function validateSeverity(v: unknown): "low" | "medium" | "high" {
  if (v === "low" || v === "medium" || v === "high") return v;
  return "medium";
}

function validatePriority(v: unknown): "low" | "medium" | "high" {
  if (v === "low" || v === "medium" || v === "high") return v;
  return "medium";
}

// ─── FETCH WITH TIMEOUT ───────────────────────────────

function fetchTimeout(url: string, options: RequestInit) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), TIMEOUT)
    ),
  ]) as Promise<Response>;
}

// ─── TEXT AI ──────────────────────────────────────────

export async function askAI(req: AIRequest): Promise<NormalizedAIResponse> {
  try {
    if (!endpoint || !apiKey) throw new Error("no_ai");

    const system = `
You are an expert agricultural advisor.

RULES:
- Be SPECIFIC (mention diseases, nutrients, causes)
- DO NOT give generic advice
- Always diagnose if possible
- Always give step-by-step actions
- Use farmer-friendly language

RETURN STRICT JSON:
{
  "content": "short explanation",
  "diagnosis": {"issue": "specific issue", "confidence": 0.85, "severity": "low|medium|high"},
  "actions": [{"title": "step description", "priority": "low|medium|high"}],
  "alerts": [{"level": "low|medium|high", "message": "alert text"}],
  "followUpQuestions": ["question 1?"]
}
`;

    const farmContext = req.farmRecords?.length
      ? `\n\nFarm context:\n${req.farmRecords.map((r) => `- ${r.name} (${r.recordType}) — ${r.healthStatus}`).join("\n")}`
      : "";

    const res = await fetchTimeout(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: req.query + farmContext },
        ],
        temperature: 0.3,
      }),
    });

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || "";

    let parsed: unknown;
    try {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[1].trim() : raw);
    } catch {
      // Plain text response — normalize will handle it
      parsed = { content: raw };
    }

    return normalizeAIResponse(parsed, "ai-model");
  } catch {
    const fallback = getGuidance(req.query, "advice");

    return normalizeAIResponse(
      {
        content: fallback.summary,
        guidance: fallback,
        source: "knowledge-base",
      },
      "knowledge-base"
    );
  }
}

// ─── IMAGE AI (USED BY FARMSCAN) ─────────────────────

export async function runAI(payload: {
  mode: "image";
  imageUrl: string;
  prompt?: string;
}): Promise<NormalizedAIResponse> {
  try {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-diagnosis`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: payload.imageUrl,
          prompt: payload.prompt || "Analyze crop disease",
        }),
      }
    );

    const raw = await res.json();
    return normalizeAIResponse(raw, "ai-model");
  } catch {
    return normalizeAIResponse(
      { content: "Image analysis unavailable. Please try again later." },
      "knowledge-base"
    );
  }
}

// ─── HELPERS ──────────────────────────────────────────

export function buildDailyTipsQuery(farmRecords?: FarmRecord[]) {
  const context = farmRecords?.length
    ? `\nMy farm: ${farmRecords.map((r) => r.name).join(", ")}`
    : "";
  return `Give 5 simple farming tips for this week.${context}`;
}

export function buildFarmAnalysisQuery(farmRecords?: FarmRecord[]) {
  const context = farmRecords?.length
    ? farmRecords
        .map((r) => `${r.name} (${r.recordType}) - ${r.healthStatus}`)
        .join("\n")
    : "No farm data";

  return `
Analyse my farm and give actionable recommendations:

Farm records:
${context}

Give:
1. Overall farm health assessment
2. Priority actions for this week
3. Risks to watch out for
4. Opportunities to improve yield
`;
}
