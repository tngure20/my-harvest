import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const HF_BASE = "https://api-inference.huggingface.co";
const MODELS = {
  text: "mistralai/Mistral-7B-Instruct-v0.3",
  image: "linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification",
  imageFallback: "google/vit-base-patch16-224",
  embedding: "sentence-transformers/all-MiniLM-L6-v2",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getHFKey(): string {
  const key = Deno.env.get("HF_API_KEY");
  if (!key) throw new Error("HF_API_KEY not configured");
  return key;
}

async function hfFetch(url: string, body: unknown, contentType = "application/json", timeout = 30000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const options: RequestInit = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getHFKey()}`,
        "Content-Type": contentType,
      },
      signal: controller.signal,
      body: contentType === "application/json" ? JSON.stringify(body) : body as BodyInit,
    };
    return await fetch(url, options);
  } finally {
    clearTimeout(timer);
  }
}

async function handleText(prompt: string, maxTokens = 600, temperature = 0.35) {
  // HF Inference Router exposes an OpenAI-compatible chat-completions endpoint.
  const res = await hfFetch("https://router.huggingface.co/v1/chat/completions", {
    model: MODELS.text,
    messages: [{ role: "user", content: prompt }],
    max_tokens: maxTokens,
    temperature,
    stream: false,
  });

  if (res.status === 503) {
    const body = await res.json().catch(() => ({}));
    return { error: "model_loading", estimated_time: body.estimated_time || 20 };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { error: `hf_error_${res.status}`, detail: text.slice(0, 300) };
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) return { error: "empty_response" };
  return { success: true, content, model: MODELS.text };
}

async function handleImage(imageBytes: Uint8Array, contentType: string) {
  for (const modelId of [MODELS.image, MODELS.imageFallback]) {
    try {
      const res = await hfFetch(`${HF_BASE}/models/${modelId}`, imageBytes, contentType, 25000);
      if (res.status === 503) continue;
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data) && data[0]?.label) {
        return { success: true, predictions: data.slice(0, 5), model: modelId };
      }
    } catch {
      continue;
    }
  }
  return { error: "image_classification_failed" };
}

async function handleEmbedding(inputs: string | string[]) {
  const res = await hfFetch(`${HF_BASE}/models/${MODELS.embedding}`, {
    inputs,
    options: { wait_for_model: true },
  });

  if (res.status === 503) {
    const body = await res.json().catch(() => ({}));
    return { error: "model_loading", estimated_time: body.estimated_time || 20 };
  }
  if (!res.ok) return { error: `hf_error_${res.status}` };

  const data = await res.json();
  return { success: true, embeddings: data };
}

// ─── News (verified agricultural sources) ─────────────────────────────────────

interface NewsArticle {
  title: string;
  link: string;
  source: string;
  pubDate: string;
  summary: string;
  scope: "kenya" | "east-africa" | "global";
}

// Trusted, agriculture-focused RSS feeds. Tagged by geographic scope so the
// frontend can do hierarchical filtering (county → kenya → east-africa → global).
const NEWS_FEEDS: { url: string; source: string; scope: NewsArticle["scope"] }[] = [
  // Kenya / East Africa
  { url: "https://www.farmersreviewafrica.com/feed/",                       source: "Farmers Review Africa", scope: "east-africa" },
  { url: "https://www.theeastafrican.co.ke/tea/business/agribusiness/rss",  source: "The East African",      scope: "east-africa" },
  { url: "https://www.nation.africa/kenya/business/seeds-of-gold/rss.xml",   source: "Nation – Seeds of Gold", scope: "kenya" },
  // Global agriculture (research / policy)
  { url: "https://www.fao.org/news/rss-feed/en/",                            source: "FAO",                    scope: "global" },
  { url: "https://www.cgiar.org/news/feed/",                                 source: "CGIAR",                  scope: "global" },
  { url: "https://news.un.org/feed/subscribe/en/news/topic/agriculture/feed/rss.xml", source: "UN News – Agriculture", scope: "global" },
];

// In-memory cache (per Edge Function instance). 6h TTL.
const NEWS_CACHE_TTL = 6 * 60 * 60 * 1000;
let newsCache: { articles: NewsArticle[]; fetchedAt: number } | null = null;

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

function stripHtml(s: string): string {
  return decodeEntities(s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "")).trim();
}

function extractTag(item: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m  = item.match(re);
  return m ? stripHtml(m[1]) : "";
}

function parseRss(xml: string, source: string, scope: NewsArticle["scope"]): NewsArticle[] {
  const items: NewsArticle[] = [];
  const itemRe = /<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi;
  const matches = xml.match(itemRe) ?? [];
  for (const raw of matches.slice(0, 10)) {
    const title   = extractTag(raw, "title");
    let link      = extractTag(raw, "link");
    if (!link) {
      const hrefMatch = raw.match(/<link[^>]*href=["']([^"']+)["']/i);
      link = hrefMatch ? hrefMatch[1] : "";
    }
    const pubDate = extractTag(raw, "pubDate") || extractTag(raw, "updated") || extractTag(raw, "published");
    const desc    = extractTag(raw, "description") || extractTag(raw, "summary") || extractTag(raw, "content");
    if (title && link) {
      items.push({
        title,
        link,
        source,
        pubDate: pubDate || new Date().toISOString(),
        summary: desc.slice(0, 280),
        scope,
      });
    }
  }
  return items;
}

async function fetchFeed(url: string, source: string, scope: NewsArticle["scope"]): Promise<NewsArticle[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "HarvestApp/1.0 (+agriculture-aggregator)" },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRss(xml, source, scope);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function getNewsArticles(forceRefresh = false): Promise<NewsArticle[]> {
  const now = Date.now();
  if (!forceRefresh && newsCache && now - newsCache.fetchedAt < NEWS_CACHE_TTL) {
    return newsCache.articles;
  }
  const results = await Promise.allSettled(
    NEWS_FEEDS.map((f) => fetchFeed(f.url, f.source, f.scope))
  );
  const articles = results
    .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  if (articles.length > 0) {
    newsCache = { articles, fetchedAt: now };
  }
  return articles;
}

async function handleNews(body: { location?: string; country?: string; limit?: number; query?: string }) {
  const limit    = Math.min(Math.max(body.limit ?? 10, 1), 30);
  const country  = (body.country ?? "Kenya").toLowerCase();
  const location = (body.location ?? "").toLowerCase();
  const query    = (body.query ?? "").toLowerCase();

  let articles: NewsArticle[];
  try {
    articles = await getNewsArticles();
  } catch {
    return { error: "news_fetch_failed" };
  }
  if (articles.length === 0) return { error: "no_articles" };

  // Hierarchical filter — score each article: location > country > scope
  const scored = articles.map((a) => {
    const blob = `${a.title} ${a.summary}`.toLowerCase();
    let score = 0;
    if (location && blob.includes(location)) score += 10;
    if (country && (blob.includes(country) || a.scope === "kenya")) score += 5;
    if (a.scope === "kenya")        score += 3;
    if (a.scope === "east-africa")  score += 2;
    if (a.scope === "global")       score += 1;
    if (query) {
      const words = query.split(/\s+/).filter((w) => w.length > 3);
      score += words.filter((w) => blob.includes(w)).length * 2;
    }
    return { article: a, score };
  });

  scored.sort((a, b) => b.score - a.score ||
    new Date(b.article.pubDate).getTime() - new Date(a.article.pubDate).getTime()
  );

  return {
    success: true,
    articles: scored.slice(0, limit).map((s) => s.article),
    cachedAt: newsCache?.fetchedAt ?? Date.now(),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
const path = url.pathname.replace(/^.*\//, "");
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "method_not_allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: Record<string, unknown>;

    if (path === "text") {
      const body = await req.json();
      result = await handleText(body.prompt, body.maxTokens, body.temperature);
    } else if (path === "image") {
      const body = await req.json();
      const imageBase64: string = body.imageBase64;
      const contentType: string = body.contentType || "image/jpeg";
      const bytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));
      result = await handleImage(bytes, contentType);
    } else if (path === "embed") {
      const body = await req.json();
      result = await handleEmbedding(body.inputs);
    } else if (path === "news") {
      const body = await req.json().catch(() => ({}));
      result = await handleNews(body);
    } else {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), {
      status: result.error ? 502 : 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: "internal", detail: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
