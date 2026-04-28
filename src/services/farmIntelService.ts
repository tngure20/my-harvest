/**
 * Farm Intelligence Service
 * ──────────────────────────────────────────────────────────────────
 * Single client-side entry point to the unified Farm Intelligence Engine.
 *
 * The frontend NEVER orchestrates weather + news + AI for this view — the
 * Edge Function `ai-gateway/farm-intel` does all of that server-side using
 * the caller's JWT to scope reads. The function:
 *
 *   1. Loads the farmer's profile, farm activities, tasks and records
 *   2. Pulls weather from `weather_cache` (Open-Meteo, 30-min TTL)
 *   3. Pulls regional agri-news from RSS (6h in-memory cache)
 *   4. Sends a single fused context to Mistral-7B
 *   5. Parses structured JSON, persists each alert in
 *      `farm_intelligence_alerts`, and returns a single decision object
 *
 * If AI is unavailable the function returns a heuristic fallback built from
 * weather signals + overdue tasks — never empty, never silent.
 */

import { supabase } from "@/services/supabaseClient";

export type IntelRiskLevel = "low" | "medium" | "high";
export type IntelAlertType  = "weather" | "pest" | "disease" | "market" | "general";
export type IntelAlertSource = "weather" | "news" | "ai" | "farm" | "fallback";

export interface FarmIntelAlert {
  type:     IntelAlertType | string;
  severity: IntelRiskLevel | string;
  title:    string;
  message:  string;
  source:   IntelAlertSource | string;
}

export interface FarmIntelAction {
  activity:           string;
  action:             string;
  due_within_days?:   number;
}

export interface FarmIntelligence {
  risk_level:      IntelRiskLevel;
  headline:        string;
  alerts:          FarmIntelAlert[];
  recommendations: string[];
  farm_actions:    FarmIntelAction[];
  reasoning:       string;
}

export interface FarmIntelMeta {
  hasWeather:    boolean;
  hasNews:       boolean;
  activityCount: number;
  newsCount:     number;
  generatedAt:   string;
  location:      string;
}

export interface FarmIntelResult {
  intelligence: FarmIntelligence;
  aiSource:     "huggingface" | "fallback";
  contextMeta?: FarmIntelMeta;
  cachedAt?:    string;
  fromCache?:   boolean;
}

// ─── In-memory cache ─────────────────────────────────────────────────────────
// Keep one snapshot per session — backend already enforces a 1h TTL via the
// `farm_intelligence_alerts` table, so this is just to avoid duplicate calls
// during a single page render cycle.

const CLIENT_TTL_MS = 5 * 60 * 1000; // 5 min
let _cache: { data: FarmIntelResult; expiresAt: number } | null = null;

export function clearFarmIntelCache(): void {
  _cache = null;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch unified farm intelligence for the signed-in user. The Edge Function
 * does ALL the orchestration — this is a single network call.
 *
 * @param opts.force  Bypass both client and server caches (use sparingly —
 *                    triggers a full Mistral call)
 */
export async function fetchFarmIntelligence(
  opts: { force?: boolean } = {}
): Promise<FarmIntelResult> {
  if (!opts.force && _cache && Date.now() < _cache.expiresAt) {
    return _cache.data;
  }

  const { data, error } = await supabase.functions.invoke("ai-gateway/farm-intel", {
    body: { force: !!opts.force },
  });

  if (error) {
    throw new Error(describeError(error));
  }
  if (!data || data.error) {
    throw new Error(data?.error ? friendlyServerError(data.error) : "Empty response from intelligence engine");
  }
  if (!data.intelligence) {
    throw new Error("Invalid response from intelligence engine");
  }

  const result: FarmIntelResult = {
    intelligence: data.intelligence as FarmIntelligence,
    aiSource:     (data.aiSource as "huggingface" | "fallback") ?? "fallback",
    contextMeta:  data.contextMeta as FarmIntelMeta | undefined,
    cachedAt:     data.cachedAt as string | undefined,
    fromCache:    !!data.fromCache,
  };

  _cache = { data: result, expiresAt: Date.now() + CLIENT_TTL_MS };
  return result;
}

function describeError(err: { message?: string; status?: number; context?: { status?: number } } | null): string {
  if (!err) return "Unknown error";
  const status = err.status ?? err.context?.status;
  const msg = err.message || "";
  if (status === 401 || /401|unauthor/i.test(msg)) return "Sign in to use Farm Intelligence.";
  if (status === 429 || /429|rate/i.test(msg))    return "Too many requests — please wait a moment.";
  if (status === 503 || /503|unavail/i.test(msg)) return "Intelligence service is warming up. Try again in a few seconds.";
  if (/network|fetch|failed to/i.test(msg))       return "Network error — check your connection.";
  return msg || "Intelligence service error";
}

function friendlyServerError(code: string): string {
  switch (code) {
    case "missing_authorization": return "Sign in to use Farm Intelligence.";
    case "invalid_token":         return "Your session expired. Please sign in again.";
    case "supabase_not_configured": return "Backend is not fully configured (service role missing).";
    default:                      return code.replace(/_/g, " ");
  }
}
