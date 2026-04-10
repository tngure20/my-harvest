/**
 * AI Service Layer — Harvest Farm Assistant (Production Ready)
 */

import {
  getGuidance,
  type AssistantMode,
  type GuidanceResponse,
} from "@/lib/agricultureKnowledge";
import type { FarmRecord } from "@/services/farmService";

// ─── Types ───────────────────────────────────────────────

export interface AIRequest {
  mode: AssistantMode;
  query: string;
  userId?: string;
  farmRecords?: FarmRecord[];
}

export interface AIResponse {
  content: string;
  actions?: any[];
  alerts?: any[];
  guidance?: GuidanceResponse;
  source: "knowledge-base" | "ai-model";
}

// ─── Config ──────────────────────────────────────────────

const endpoint = import.meta.env.VITE_AI_ENDPOINT;
const apiKey = import.meta.env.VITE_AI_API_KEY;
const model = import.meta.env.VITE_AI_MODEL || "mistralai/Mistral-7B-Instruct-v0.2";

const AI_TIMEOUT_MS = 25000;

// ─── System Prompt ───────────────────────────────────────

function buildSystemPrompt(mode: AssistantMode, farmRecords?: FarmRecord[]): string {
  const modeInstructions: Record<AssistantMode, string> = {
    advice: `You are an expert agricultural advisor for East African smallholder farmers.
Give practical, actionable farming advice. Avoid theory.`,

    diagnosis: `You are an agricultural diagnostician.
Help identify crop and livestock problems based on symptoms.
Always suggest possible causes and immediate actions.`,

    planning: `You are a farm planning assistant.
Help with seasonal planning, fertilizer schedules, and farm optimization.`,
  };

  const farmContext =
    farmRecords?.length
      ? `\nFarmer Data:\n${farmRecords
          .map(
            (f) =>
              `- ${f.name} (${f.recordType}${
                f.cropType ? `/${f.cropType}` : ""
              }) — ${f.healthStatus}`
          )
          .join("\n")}`
      : "";

  return `
${modeInstructions[mode]}

Current Date: ${new Date().toLocaleDateString("en-KE")}

${farmContext}

Rules:
- Be practical and concise
- Give step-by-step actions
- Avoid long explanations
- Always prioritize farmer safety

End with: "Consult a local extension officer for confirmation."
`;
}

// ─── Timeout wrapper ─────────────────────────────────────

function fetchWithTimeout(url: string, options: RequestInit, timeout: number) {
  return Promise.race([
    fetch(url, options),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error("AI_TIMEOUT")), timeout)
    ),
  ]);
}

// ─── AI API Call ─────────────────────────────────────────

async function callAIEndpoint(systemPrompt: string, userQuery: string): Promise<string> {
  if (!endpoint || !apiKey) {
    throw new Error("AI_NOT_CONFIGURED");
  }

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
        max_tokens: 700,
      }),
    },
    AI_TIMEOUT_MS
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI_API_ERROR_${res.status}: ${text}`);
  }

  const data = await res.json();

  return (
    data?.choices?.[0]?.message?.content?.trim() ||
    "No response generated."
  );
}

// ─── Markdown fallback formatter ─────────────────────────

function guidanceToMarkdown(guidance: GuidanceResponse): string {
  return [
    `## ${guidance.title}`,
    "",
    guidance.summary,
    "",
    ...guidance.sections.flatMap((s) => [
      `### ${s.heading}`,
      ...s.points.map((p) => `- ${p}`),
      "",
    ]),
    guidance.sources.length
      ? `---\nSources: ${guidance.sources.map((s) => s.name).join(", ")}`
      : "",
    "",
    `> ⚠️ ${guidance.disclaimer}`,
  ].join("\n");
}

// ─── Main AI Function ────────────────────────────────────

export async function askAI(request: AIRequest): Promise<AIResponse> {
  const { mode, query, farmRecords } = request;

  try {
    const systemPrompt = buildSystemPrompt(mode, farmRecords);
    const content = await callAIEndpoint(systemPrompt, query);

    return {
      content,
      source: "ai-model",
    };
  } catch (err: any) {
    console.warn("[AI SERVICE] Falling back:", err.message);

    // fallback ONLY if AI fails
    const guidance = getGuidance(query, mode);
    return {
      content: guidanceToMarkdown(guidance),
      guidance,
      source: "knowledge-base",
    };
  }
}
 // ─── DAILY TIPS QUERY ─────────────────────────────────────

export function buildDailyTipsQuery(farmRecords?: FarmRecord[]): string {
  const month = new Date().toLocaleString("en-KE", { month: "long" });

  const activities =
    farmRecords?.length
      ? ` My current farm activities include: ${farmRecords
          .map((a) => a.name)
          .join(", ")}.`
      : "";

  return `Give me 5 practical farming tips for ${month} in Kenya that I should act on this week.${activities} Focus on:
- seasonal farming tasks
- pest and disease risks
- weather-based actions
- market opportunities

Keep answers short and actionable.`;
}

// ─── FARM ANALYSIS QUERY ─────────────────────────────────

export function buildFarmAnalysisQuery(farmRecords: FarmRecord[]): string {
  if (!farmRecords || farmRecords.length === 0) {
    return "I have no farm records yet. What should I start tracking first to improve farm management?";
  }

  const summary = farmRecords
    .map(
      (a) =>
        `${a.name} (${a.recordType}${
          a.cropType ? `/${a.cropType}` : ""
        }) — health: ${a.healthStatus}`
    )
    .join("; ");

  return `Analyze my farm situation and give me a priority action plan for this week.

Farm data:
${summary}

Tell me:
- what is urgent
- what I should fix first
- risks I should watch
- simple next steps`;
}
