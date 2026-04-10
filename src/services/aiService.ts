/**
 * AI Service Layer — Harvest Farm Assistant
 *
 * Model-agnostic design. Swap to a real LLM by setting:
 *   VITE_AI_ENDPOINT  — OpenAI-compatible base URL (e.g. https://api-inference.huggingface.co/v1)
 *   VITE_AI_API_KEY   — API key / HuggingFace token
 *   VITE_AI_MODEL     — Model name (e.g. mistralai/Mixtral-8x7B-Instruct-v0.1)
 *
 * When those vars are absent, the service falls back to the local knowledge base
 * so the app remains fully functional without any API key.
 */

import {
  getGuidance,
  type AssistantMode,
  type GuidanceResponse,
} from "@/lib/agricultureKnowledge";
import type { FarmRecord } from "@/services/farmService";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface AIRequest {
  mode: AssistantMode;
  query: string;
  userId?: string;
  farmRecords?: FarmRecord[];
}

export interface AIResponse {
  content: string;
  guidance?: GuidanceResponse;
  source: "knowledge-base" | "ai-model";
}

// ─── System prompt builder ────────────────────────────────────────────────────

function buildSystemPrompt(mode: AssistantMode, farmRecords?: FarmRecord[]): string {
  const modeInstructions: Record<AssistantMode, string> = {
    advice: `You are a knowledgeable agricultural advisor specializing in East African farming.
Answer questions about crops, livestock, soil health, irrigation, pest management, and general farming.
Base your answers on verified agronomic science and local Kenyan/East African farming practices.
Keep answers practical, actionable, and suitable for smallholder farmers.`,

    diagnosis: `You are an expert agricultural diagnostician for East African farms.
Help farmers identify and treat crop diseases, pest infestations, livestock illnesses, and other farm problems.
When diagnosing, ask about symptoms, location, severity, and duration.
Always recommend consulting a local vet or extension officer for serious issues.`,

    planning: `You are a strategic farm planning assistant for East African smallholder farmers.
Help with planting calendars, seasonal scheduling, fertilizer plans, budgeting, and farm activity management.
Reference Kenya's long rains (March–May) and short rains (October–December) seasons where relevant.
Provide concrete schedules and timelines.`,
  };

  const dailyTipsContext = `Today is ${new Date().toLocaleDateString("en-KE", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })}. The current month is ${new Date().toLocaleString("en-KE", { month: "long" })}.`;

  const farmContext =
    farmRecords && farmRecords.length > 0
      ? `\n\nFarmer's current farm records:\n${farmRecords
          .map((a) => `- ${a.name} (${a.recordType}${a.cropType ? ` / ${a.cropType}` : ""}) — ${a.healthStatus}`)
          .join("\n")}`
      : "";

  const knowledgeSources = `
Verified knowledge sources to reference:
- Kenya Ministry of Agriculture (kilimo.go.ke)
- KALRO — Kenya Agricultural & Livestock Research Organization
- FAO — Food and Agriculture Organization
- ICIPE — International Centre of Insect Physiology and Ecology
- ILRI — International Livestock Research Institute
- Kenya Agricultural Extension Service`;

  return `${modeInstructions[mode]}

${dailyTipsContext}${farmContext}
${knowledgeSources}

Format responses clearly using markdown:
- Use **bold** for important terms and actions
- Use bullet points for lists of steps or recommendations
- Use ## headings to separate major sections
- Keep language simple and accessible to farmers who may be reading on mobile

Always end responses with a brief disclaimer about consulting local extension officers for site-specific advice.`;
}

// ─── Daily tips prompt ────────────────────────────────────────────────────────

export function buildDailyTipsQuery(farmRecords?: FarmRecord[]): string {
  const month = new Date().toLocaleString("en-KE", { month: "long" });
  const activities =
    farmRecords && farmRecords.length > 0
      ? ` My current activities are: ${farmRecords.map((a) => a.name).join(", ")}.`
      : "";
  return `Give me 5 practical farming tips for ${month} in Kenya that I should act on this week.${activities} Focus on seasonal tasks, pest alerts, and market opportunities.`;
}

// ─── Farm analysis prompt ─────────────────────────────────────────────────────

export function buildFarmAnalysisQuery(farmRecords: FarmRecord[]): string {
  if (farmRecords.length === 0) {
    return "I haven't added any farm records yet. What should I start tracking to improve my farm management?";
  }
  const summary = farmRecords
    .map((a) => `${a.name} (${a.recordType}${a.cropType ? `/${a.cropType}` : ""}) — health: ${a.healthStatus}`)
    .join("; ");
  return `Analyze my farm and give me a priority action plan. My records: ${summary}. What should I focus on this week and what risks should I watch for?`;
}

// ─── OpenAI-compatible API call ───────────────────────────────────────────────

interface OpenAIChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function callAIEndpoint(
  systemPrompt: string,
  userQuery: string,
  conversationHistory: OpenAIChatMessage[] = []
): Promise<string> {
  const endpoint = import.meta.env.VITE_AI_ENDPOINT;
  const apiKey = import.meta.env.VITE_AI_API_KEY;
  const model = import.meta.env.VITE_AI_MODEL || "gpt-3.5-turbo";

  if (!endpoint || !apiKey) {
    throw new Error("AI_NOT_CONFIGURED");
  }

  const messages: OpenAIChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.slice(-6),
    { role: "user", content: userQuery },
  ];

  const res = await fetch(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 800,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "No response from AI model.";
}

// ─── Knowledge-base fallback formatter ───────────────────────────────────────

function guidanceToMarkdown(guidance: GuidanceResponse): string {
  const lines: string[] = [
    `## ${guidance.title}`,
    "",
    guidance.summary,
    "",
  ];

  for (const section of guidance.sections) {
    lines.push(`### ${section.heading}`);
    for (const point of section.points) {
      lines.push(`- ${point}`);
    }
    lines.push("");
  }

  if (guidance.sources.length > 0) {
    lines.push("---");
    lines.push(
      `*Sources: ${guidance.sources.map((s) => s.name).join(", ")}*`
    );
    lines.push("");
  }

  lines.push(`> ⚠️ ${guidance.disclaimer}`);

  return lines.join("\n");
}

// ─── Main exported function ───────────────────────────────────────────────────

export async function askAI(request: AIRequest): Promise<AIResponse> {
  const { mode, query, farmRecords } = request;
  const systemPrompt = buildSystemPrompt(mode, farmRecords);

  try {
    const content = await callAIEndpoint(systemPrompt, query);
    return { content, source: "ai-model" };
  } catch (err) {
    if (err instanceof Error && err.message !== "AI_NOT_CONFIGURED") {
      console.warn("[aiService] AI endpoint error, falling back to knowledge base:", err.message);
    }
  }

  // Fallback: local knowledge base
  const guidance = getGuidance(query, mode);
  const content = guidanceToMarkdown(guidance);
  return { content, guidance, source: "knowledge-base" };
}
