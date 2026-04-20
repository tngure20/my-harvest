/**
 * News Service — verified agricultural news
 * ──────────────────────────────────────────────────────────────────
 * Calls the secure Supabase Edge Function `ai-gateway/news` which
 * aggregates RSS feeds from trusted sources (FAO, CGIAR, UN News,
 * Nation Seeds of Gold, The East African, Farmers Review Africa).
 *
 * Hierarchical resolution: county/location → country → east-africa →
 * global. The backend scores articles; this layer just caches results
 * for 1 hour in localStorage to keep the home screen snappy.
 *
 * NO API keys are used or stored client-side. NO hardcoded articles.
 */

import { supabase } from "@/services/supabaseClient";

export interface NewsArticle {
  title: string;
  link: string;
  source: string;
  pubDate: string;
  summary: string;
  scope: "kenya" | "east-africa" | "global";
}

export interface NewsQuery {
  location?: string;
  country?: string;
  query?: string;
  limit?: number;
}

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const CACHE_KEY = "harvest_news_v1";

interface CacheEntry {
  key: string;
  articles: NewsArticle[];
  expiresAt: number;
}

function buildCacheKey(q: NewsQuery): string {
  return `${q.location ?? ""}|${q.country ?? ""}|${q.query ?? ""}|${q.limit ?? 10}`.toLowerCase();
}

function readCache(key: string): NewsArticle[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (entry.key !== key || Date.now() > entry.expiresAt) return null;
    return entry.articles;
  } catch {
    return null;
  }
}

function writeCache(key: string, articles: NewsArticle[]): void {
  try {
    const entry: CacheEntry = { key, articles, expiresAt: Date.now() + CACHE_TTL };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    /* quota — non-fatal */
  }
}

/**
 * Fetch verified agricultural news, scoped by location when possible.
 * Returns [] on any failure — never throws.
 */
export async function fetchAgriNews(query: NewsQuery = {}): Promise<NewsArticle[]> {
  const key = buildCacheKey(query);
  const cached = readCache(key);
  if (cached) return cached;

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const res = await fetch(`${supabaseUrl}/functions/v1/ai-gateway/news`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
      },
      body: JSON.stringify({
        location: query.location,
        country:  query.country ?? "Kenya",
        query:    query.query,
        limit:    query.limit ?? 10,
      }),
    });

    if (!res.ok) {
      console.warn("[newsService] backend error:", res.status, await res.text().catch(() => ""));
      return [];
    }
    const data = await res.json();
    if (data?.error || !Array.isArray(data?.articles)) {
      console.warn("[newsService] no articles:", data?.error);
      return [];
    }

    const articles = data.articles as NewsArticle[];
    writeCache(key, articles);
    return articles;
  } catch (err) {
    console.warn("[newsService] fetch failed:", (err as Error).message);
    return [];
  }
}

/** Format top headlines as a concise prompt-ready string for AI context. */
export function newsToPromptString(articles: NewsArticle[], max = 3): string {
  if (!articles.length) return "";
  const lines = articles.slice(0, max).map((a) =>
    `- ${a.title} (${a.source})`
  );
  return `Recent agricultural headlines:\n${lines.join("\n")}`;
}

/** Clear cached news (useful after location change). */
export function clearNewsCache(): void {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* noop */ }
}
