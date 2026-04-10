import {
  getGuidance,
  type AssistantMode,
  type GuidanceResponse,
} from "@/lib/agricultureKnowledge";
import type { FarmRecord } from "@/services/farmService";

// ─── TYPES ───────────────────────────────────────────────

export type AIQueryMode =
  | "advice"
  | "diagnosis"
  | "planning"
  | "general";

export interface AIRequest {
  mode: AIQueryMode;
  query: string;
  userId?: string;
  farmRecords?: FarmRecord[];
}

export interface AIResponse {
  content: string;

  actions?: {
    title: string;
    priority: "low" | "medium" | "high";
    due_date?: string;
  }[];

  alerts?: {
    level: "low" | "medium" | "high";
    message: string;
  }[];

  insights?: string[];

  confidence?: number;

  source: "knowledge-base" | "ai-model";
}

// ─── CONFIG ──────────────────────────────────────────────

const endpoint = import.meta.env.VITE_AI_ENDPOINT;
const apiKey = import.meta.env.VITE_AI_API_KEY;
const model =
  import.meta.env.VITE_AI_MODEL ||
  "mistralai/Mistral-7B-Instruct-v0.2";

const AI_TIMEOUT_MS = 25000;

// ─── SYSTEM PROMPT ───────────────────────────────────────

function buildSystemPrompt(
  mode: AIQueryMode,
  farmRecords?: FarmRecord[]
): string {
  const baseInstructions = `
You are Harvest AI, an agricultural assistant for farmers.

You MUST:
- Respond in clear, simple language
- Be practical and actionable
- Avoid long theory
- Assume user may be beginner farmer
- Prioritize real-world usefulness
`;

  const modeInstructions: Record<AIQueryMode, string> = {
    advice: `You give farming advice based on agricultural science.`,

    diagnosis: `You help diagnose crop or livestock problems from symptoms.`,

    planning: `You help plan farming schedules, inputs, and seasonal activities.`,

    general: `You answer general agricultural questions, even if no farm data is provided.`,
  };

  const farmContext =
    farmRecords?.length
      ? `\nFarm Context (optional reference only):
${farmRecords
  .map(
    (f) =>
      `- ${f.name} (${f.recordType}${
        f.cropType ? `/${f.cropType}` : ""
      }) — ${f.healthStatus}`
  )
  .join("\n")}`
      : "";

  return `
${baseInstructions}

${modeInstructions[mode]}

${farmContext}

OUTPUT FORMAT:
Return JSON ONLY:

{
  "content": "main answer for farmer",
  "actions": [
    { "title": "...", "priority": "low|medium|high", "due_date": "optional" }
  ],
  "alerts": [
    { "level": "low|medium|high", "message": "..." }
  ],
  "insights": [
    "short insight"
  ],
  "confidence": 0.0
}

RULES:
- If question is general, DO NOT force farm context
- If farm data helps, use it lightly
- Always be clear and non-technical
- Never hallucinate certainty
`;
}

// ─── TIMEOUT FETCH ───────────────────────────────────────

function fetchWithTimeout(url: string, options: RequestInit, timeout: number) {
  return Promise.race([
    fetch(url, options),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error("AI_TIMEOUT")), timeout)
    ),
  ]);
}

// ─── API CALL ───────────────────────────────────────────

async function callAIEndpoint(
  systemPrompt: string,
  userQuery: string
): Promise<string> {
  if (!endpoint || !apiKey) throw new Error("AI_NOT_CONFIGURED");

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userQuery },
  ];

  const res = await fetchWithTimeout(
    `${endpoint}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.6,
        max_tokens: 800,
      }),
    },
    AI_TIMEOUT_MS
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI_ERROR_${res.status}: ${text}`);
  }

  const data = await res.json();

  return data?.choices?.[0]?.message?.content?.trim() || "";
}

// ─── MAIN FUNCTION ──────────────────────────────────────

export async function askAI(request: AIRequest): Promise<AIResponse> {
  const { mode, query, farmRecords } = request;

  try {
    const systemPrompt = buildSystemPrompt(mode, farmRecords);
    const raw = await callAIEndpoint(systemPrompt, query);

    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        content: raw,
        source: "ai-model",
        actions: [],
        alerts: [],
        insights: [],
        confidence: 0.5,
      };
    }

    return {
      content: parsed.content || "",
      actions: parsed.actions || [],
      alerts: parsed.alerts || [],
      insights: parsed.insights || [],
      confidence: parsed.confidence || 0.5,
      source: "ai-model",
    };
  } catch (err) {
    console.warn("[AI] fallback:", err);

    const guidance = getGuidance(query, mode as any);

    return {
      content: guidance.summary,
      source: "knowledge-base",
    };
  }
}

// ─── QUERY BUILDERS ─────────────────────────────────────

export function buildDailyTipsQuery(farmRecords?: FarmRecord[]) {
  const month = new Date().toLocaleString("en-KE", { month: "long" });

  const activities = farmRecords?.length
    ? `Current farm activities: ${farmRecords.map((a) => a.name).join(", ")}.`
    : "";

  return `Give 5 practical farming tips for ${month} in Kenya. ${activities}`;
}

export function buildFarmAnalysisQuery(farmRecords: FarmRecord[]) {
  if (!farmRecords?.length) {
    return "What should I start tracking on my farm?";
  }

  return `Analyze my farm and give priorities:
${farmRecords
  .map((f) => `${f.name} - ${f.healthStatus}`)
  .join("\n")}`;
}

// ─── IMAGE + TEXT AI WRAPPER (CRITICAL) ───────────────────

export async function runAI(payload: {
  mode: "image" | "text";
  imageUrl?: string;
  prompt?: string;
}) {
  try {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-diagnosis`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      throw new Error("AI request failed");
    }

    return await res.json();
  } catch (err) {
    console.error("[runAI ERROR]", err);

    return {
      response: "AI service unavailable. Try again later.",
    };
  }
}
