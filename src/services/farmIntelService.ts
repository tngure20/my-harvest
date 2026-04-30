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

// ─── Retry / backoff ─────────────────────────────────────────────────────────
// Mirrors the warm-up retry pattern used in `aiService.ts` for /text and /image.
// The backend handler may itself return a `model_loading`-style error if the
// underlying Mistral call cold-starts — and Supabase Edge Functions can also
// throw transient 5xx during HF cold-starts. We retry with exponential backoff
// so the UI sees a final result instead of a one-shot "service warming up" miss.

const MAX_RETRIES   = 2;     // 1 initial + 2 retries = 3 total attempts
const BASE_DELAY_MS = 4000;  // 4s, 8s

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function isTransientError(err: { status?: number; context?: { status?: number }; message?: string } | null): boolean {
  if (!err) return false;
  const status = err.status ?? err.context?.status;
  if (status === 502 || status === 503 || status === 504 || status === 408) return true;
  const msg = (err.message || "").toLowerCase();
  return /network|fetch|timeout|model_loading|warming|temporarily|503|504|non-2xx/i.test(msg);
}

function isTransientServerCode(code: string | undefined): boolean {
  if (!code) return false;
  return /^(model_loading|hf_error_5\d\d|news_fetch_failed|empty_response|internal)$/i.test(code);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch unified farm intelligence for the signed-in user. The Edge Function
 * does ALL the orchestration — this is a single network call (with transient
 * retry/backoff). Never silent: on exhausted retries we surface a friendly
 * message; the backend itself returns a heuristic fallback when AI is down so
 * even a "successful" response may have `aiSource: "fallback"`.
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

  let lastErr: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const { data, error } = await supabase.functions.invoke("ai-gateway/farm-intel", {
      body: { force: !!opts.force },
    });

    // Network / supabase-level error
    if (error) {
      if (isTransientError(error) && attempt < MAX_RETRIES) {
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
        continue;
      }
      throw new Error(describeError(error));
    }

    // Application-level error from the function
    if (!data || data.error) {
      const code = data?.error as string | undefined;
      if (isTransientServerCode(code) && attempt < MAX_RETRIES) {
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
        continue;
      }
      lastErr = new Error(code ? friendlyServerError(code) : "Empty response from intelligence engine");
      throw lastErr;
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

  throw lastErr ?? new Error("Intelligence service exhausted retries");
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
