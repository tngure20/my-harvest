import {
  getGuidance,
  type AssistantMode,
  type GuidanceResponse,
} from "@/lib/agricultureKnowledge";
import type { FarmRecord } from "@/services/farmService";

// ─── TYPES ─────────────────────────────────────────────

export interface AIRequest {
  mode: AssistantMode | "general";
  query: string;
  farmRecords?: FarmRecord[];
}

export interface AIResponse {
  content: string;

  actions?: {
    title: string;
    priority: "low" | "medium" | "high";
  }[];

  alerts?: {
    level: "low" | "medium" | "high";
    message: string;
  }[];

  insights?: string[];
  confidence?: number;

  source: "knowledge-base" | "ai-model";
}

// ─── CONFIG ────────────────────────────────────────────

const endpoint = import.meta.env.VITE_AI_ENDPOINT;
const apiKey = import.meta.env.VITE_AI_API_KEY;
const model = import.meta.env.VITE_AI_MODEL;

const TIMEOUT = 20000;

// ─── SYSTEM PROMPT ─────────────────────────────────────

function buildSystemPrompt(mode: string, farmRecords?: FarmRecord[]) {
  const base = `
You are a practical agricultural assistant for farmers.

You help with:
- crops
- livestock
- general farming questions
- market decisions
- weather-related advice

Rules:
- Be clear and simple
- Give actionable steps
- Avoid long explanations
- If unsure → say so
`;

  const farmContext =
    farmRecords?.length
      ? `\nFarmer Data:\n${farmRecords
          .map((f) => `- ${f.name} (${f.recordType})`)
          .join("\n")}`
      : "";

  return base + farmContext;
}

// ─── FETCH WITH TIMEOUT ────────────────────────────────

function fetchTimeout(url: string, options: RequestInit) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), TIMEOUT)
    ),
  ]) as Promise<Response>;
}

// ─── TEXT AI ───────────────────────────────────────────
export async function askAI(req: AIRequest): Promise<AIResponse> {
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
  "actions": [{"title": "", "priority": "low|medium|high"}],
  "alerts": [{"level": "low|medium|high", "message": ""}],
  "confidence": number
}
`;

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
          { role: "user", content: req.query },
        ],
        temperature: 0.3,
      }),
    });

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || "{}";

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { content: raw };
    }

    return {
      content: parsed.content || "No response",
      actions: parsed.actions || [],
      alerts: parsed.alerts || [],
      confidence: parsed.confidence || 0.6,
      source: "ai-model",
    };
  } catch (e) {
    const fallback = getGuidance(req.query, "advice");

    return {
      content: fallback.summary,
      source: "knowledge-base",
    };
  }
}


// ─── IMAGE AI (USED BY FARMSCAN) ───────────────────────

export async function runAI(payload: {
  mode: "image";
  imageUrl: string;
  prompt?: string;
}) {
  const res = await fetch(
    "https://YOUR_SUPABASE_PROJECT.functions.supabase.co/ai-diagnosis",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  return res.json();
}

// ─── HELPERS ───────────────────────────────────────────

export function buildDailyTipsQuery() {
  return `Give 5 simple farming tips for this week.`;
}
export function buildFarmAnalysisQuery(
  question: string,
  farmRecords?: FarmRecord[]
) {
  const context = farmRecords?.length
    ? farmRecords.map(r => `${r.name} (${r.recordType}) - ${r.healthStatus}`).join("\n")
    : "No farm data";

  return `
Farmer question:
"${question}"

Farm context:
${context}

Give:
1. Diagnosis (if possible)
2. Clear cause
3. Step-by-step solution
4. Preventive measures

Be specific. Avoid generic advice.
`;
}
