import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

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

// ═══════════════════════════════════════════════════════════════════════════
// FARM INTELLIGENCE ENGINE
// ═══════════════════════════════════════════════════════════════════════════
// Unified decision layer that fuses profile + farm data + weather + news into
// a single Mistral-7B reasoning call and persists the resulting alerts.
// ═══════════════════════════════════════════════════════════════════════════

const WEATHER_CACHE_TTL_MS  = 30 * 60 * 1000;            // 30 min — server-side
const FARM_INTEL_CACHE_TTL_MS = 60 * 60 * 1000;          // 1h — reuse last AI run

interface OpenMeteoCurrent {
  temperature_2m: number;
  relative_humidity_2m: number;
  apparent_temperature: number;
  precipitation: number;
  weather_code: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
}
interface OpenMeteoDaily {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  precipitation_probability_max: number[];
  weather_code: number[];
  uv_index_max: number[];
  wind_speed_10m_max: number[];
}
interface OpenMeteoForecast {
  current: OpenMeteoCurrent;
  daily: OpenMeteoDaily;
}

function weatherCodeToText(code: number): string {
  const map: Record<number, string> = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Depositing rime fog",
    51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
    61: "Light rain", 63: "Rain", 65: "Heavy rain",
    71: "Light snow", 73: "Snow", 75: "Heavy snow",
    80: "Rain showers", 81: "Heavy rain showers", 82: "Violent rain",
    95: "Thunderstorm", 96: "Thunderstorm w/ hail", 99: "Severe thunderstorm",
  };
  return map[code] ?? "Unknown";
}

async function geocodeOpenMeteo(query: string): Promise<{ lat: number; lon: number; city: string; country: string } | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json();
    const r = data?.results?.[0];
    if (!r) return null;
    return { lat: r.latitude, lon: r.longitude, city: r.name, country: r.country };
  } catch { return null; }
}

async function fetchOpenMeteoForecast(lat: number, lon: number): Promise<OpenMeteoForecast | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code,uv_index_max,wind_speed_10m_max` +
      `&forecast_days=7&timezone=auto`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

interface NormalizedWeather {
  city: string;
  country: string;
  lat: number;
  lon: number;
  current: { tempC: number; feelsLikeC: number; humidity: number; rainMm: number; windKph: number; description: string };
  next7Days: Array<{ date: string; minC: number; maxC: number; precipMm: number; precipChance: number; description: string; uv: number; windKph: number }>;
  derivedSignals: string[]; // e.g. "drought-risk", "heavy-rain-day-2", "frost-risk"
}

function normalizeWeather(forecast: OpenMeteoForecast, loc: { lat: number; lon: number; city: string; country: string }): NormalizedWeather {
  const c = forecast.current;
  const d = forecast.daily;
  const days = (d.time || []).map((date, i) => ({
    date,
    minC:        d.temperature_2m_min[i],
    maxC:        d.temperature_2m_max[i],
    precipMm:    d.precipitation_sum[i],
    precipChance: d.precipitation_probability_max[i] ?? 0,
    description: weatherCodeToText(d.weather_code[i]),
    uv:          d.uv_index_max[i] ?? 0,
    windKph:     d.wind_speed_10m_max[i] ?? 0,
  }));

  const totalRain7 = days.reduce((s, x) => s + (x.precipMm ?? 0), 0);
  const heavyDays  = days.filter((x) => x.precipMm >= 25).length;
  const hotDays    = days.filter((x) => x.maxC >= 32).length;
  const coldDays   = days.filter((x) => x.minC <= 2).length;
  const windyDays  = days.filter((x) => x.windKph >= 35).length;

  const signals: string[] = [];
  if (totalRain7 < 5) signals.push("dry-7-day");
  if (heavyDays > 0)  signals.push(`heavy-rain-${heavyDays}-day(s)`);
  if (hotDays >= 2)   signals.push(`heat-stress-${hotDays}-day(s)`);
  if (coldDays > 0)   signals.push(`frost-risk-${coldDays}-day(s)`);
  if (windyDays > 0)  signals.push(`high-wind-${windyDays}-day(s)`);

  return {
    city: loc.city, country: loc.country, lat: loc.lat, lon: loc.lon,
    current: {
      tempC:       c.temperature_2m,
      feelsLikeC:  c.apparent_temperature,
      humidity:    c.relative_humidity_2m,
      rainMm:      c.precipitation,
      windKph:     c.wind_speed_10m,
      description: weatherCodeToText(c.weather_code),
    },
    next7Days: days,
    derivedSignals: signals,
  };
}

async function getOrFetchWeather(
  admin: ReturnType<typeof createClient>,
  region: string,
  country: string
): Promise<NormalizedWeather | null> {
  const locationKey = `${(region || "").toLowerCase()}|${(country || "kenya").toLowerCase()}`.trim();

  // 1. Try cache
  try {
    const { data: cached } = await admin
      .from("weather_cache")
      .select("data, fetched_at")
      .eq("location_key", locationKey)
      .maybeSingle();
    if (cached) {
      const age = Date.now() - new Date(cached.fetched_at as string).getTime();
      if (age < WEATHER_CACHE_TTL_MS) return cached.data as NormalizedWeather;
    }
  } catch { /* table may not exist yet — degrade */ }

  // 2. Geocode + fetch
  const queryStr = region ? `${region}, ${country || "Kenya"}` : (country || "Kenya");
  const geo = await geocodeOpenMeteo(queryStr);
  if (!geo) return null;
  const forecast = await fetchOpenMeteoForecast(geo.lat, geo.lon);
  if (!forecast) return null;
  const normalized = normalizeWeather(forecast, geo);

  // 3. Persist (best-effort)
  try {
    await admin.from("weather_cache").upsert({
      location_key: locationKey,
      city:         geo.city,
      country:      geo.country,
      lat:          geo.lat,
      lon:          geo.lon,
      data:         normalized,
      fetched_at:   new Date().toISOString(),
    });
  } catch { /* table missing — skip silently */ }

  return normalized;
}

interface FarmIntelContext {
  profile: {
    fullName?: string;
    role?: string;
    country?: string;
    region?: string;
    farmScale?: string;
    primaryCrops?: string[];
    livestockTypes?: string[];
    farmingActivities?: string[];
    language?: string;
  };
  activities: Array<{
    id: string;
    type: string;
    name: string;
    species?: string;
    size?: string;
    startDate?: string;
    upcomingTasks: Array<{ title: string; dueDate: string; category?: string; isOverdue: boolean }>;
    recentRecords: Array<{ type: string; description: string; date: string; quantity?: string }>;
  }>;
  weather: NormalizedWeather | null;
  news: Array<{ title: string; source: string; summary: string; scope: string }>;
  generatedAt: string;
}

async function buildContext(
  admin: ReturnType<typeof createClient>,
  userId: string
): Promise<FarmIntelContext> {
  // Profile
  const { data: profileRow } = await admin
    .from("profiles")
    .select("full_name, role, country, region, farm_scale, primary_crops, livestock_types, farming_activities, language")
    .eq("id", userId)
    .maybeSingle();
  const profile: FarmIntelContext["profile"] = {
    fullName:          profileRow?.full_name ?? undefined,
    role:              profileRow?.role ?? undefined,
    country:           profileRow?.country ?? undefined,
    region:            profileRow?.region ?? undefined,
    farmScale:         profileRow?.farm_scale ?? undefined,
    primaryCrops:      profileRow?.primary_crops ?? [],
    livestockTypes:    profileRow?.livestock_types ?? [],
    farmingActivities: profileRow?.farming_activities ?? [],
    language:          profileRow?.language ?? undefined,
  };

  // Farm activities + tasks + records (two-step batch fetch — matches frontend pattern)
  const { data: activities = [] } = await admin
    .from("farm_activities")
    .select("id, type, name, species, size, start_date")
    .eq("user_id", userId)
    .order("start_date", { ascending: false })
    .limit(20);

  const ids = (activities ?? []).map((a) => a.id as string);
  const [tasksRes, recordsRes] = await Promise.all([
    ids.length
      ? admin.from("tasks").select("activity_id, title, due_date, is_completed, category").in("activity_id", ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? admin.from("farm_records").select("activity_id, type, description, date, quantity").in("activity_id", ids).order("date", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const enrichedActivities: FarmIntelContext["activities"] = (activities ?? []).map((a) => {
    const myTasks = (tasksRes.data ?? []).filter((t: any) => t.activity_id === a.id);
    const myRecs  = (recordsRes.data ?? []).filter((r: any) => r.activity_id === a.id);
    return {
      id:        a.id as string,
      type:      a.type as string,
      name:      a.name as string,
      species:   (a.species ?? undefined) as string | undefined,
      size:      (a.size ?? undefined) as string | undefined,
      startDate: (a.start_date ?? undefined) as string | undefined,
      upcomingTasks: myTasks
        .filter((t: any) => !t.is_completed)
        .sort((x: any, y: any) => (x.due_date || "").localeCompare(y.due_date || ""))
        .slice(0, 5)
        .map((t: any) => ({
          title:     t.title,
          dueDate:   t.due_date,
          category:  t.category ?? undefined,
          isOverdue: t.due_date ? new Date(t.due_date) < today : false,
        })),
      recentRecords: myRecs.slice(0, 3).map((r: any) => ({
        type:        r.type,
        description: r.description,
        date:        r.date,
        quantity:    r.quantity ?? undefined,
      })),
    };
  });

  // Weather (cache → Open-Meteo)
  const weather = await getOrFetchWeather(admin, profile.region ?? "", profile.country ?? "Kenya");

  // News (in-memory cache, region-filtered)
  let news: FarmIntelContext["news"] = [];
  try {
    const newsResult = await handleNews({
      country:  profile.country ?? "Kenya",
      location: profile.region ?? "",
      limit:    5,
    });
    if ((newsResult as any).success) {
      news = (newsResult as any).articles.map((a: NewsArticle) => ({
        title: a.title, source: a.source, summary: a.summary, scope: a.scope,
      }));
    }
  } catch { /* non-fatal */ }

  return {
    profile,
    activities: enrichedActivities,
    weather,
    news,
    generatedAt: new Date().toISOString(),
  };
}

function summarizeContextForPrompt(ctx: FarmIntelContext): string {
  const lines: string[] = [];

  lines.push(`FARMER PROFILE`);
  lines.push(`- Location: ${ctx.profile.region || "unknown region"}, ${ctx.profile.country || "Kenya"}`);
  lines.push(`- Role: ${ctx.profile.role || "farmer"}; Scale: ${ctx.profile.farmScale || "unspecified"}`);
  if (ctx.profile.primaryCrops?.length)   lines.push(`- Primary crops: ${ctx.profile.primaryCrops.slice(0, 6).join(", ")}`);
  if (ctx.profile.livestockTypes?.length) lines.push(`- Livestock: ${ctx.profile.livestockTypes.slice(0, 6).join(", ")}`);

  lines.push(``);
  lines.push(`WEATHER (live or cached)`);
  if (ctx.weather) {
    const w = ctx.weather;
    lines.push(`- Now in ${w.city}, ${w.country}: ${Math.round(w.current.tempC)}°C ${w.current.description}, humidity ${w.current.humidity}%, wind ${Math.round(w.current.windKph)} km/h`);
    lines.push(`- 7-day rainfall total: ${Math.round(w.next7Days.reduce((s, x) => s + x.precipMm, 0))} mm`);
    if (w.derivedSignals.length) lines.push(`- Risk signals: ${w.derivedSignals.join(", ")}`);
    const next3 = w.next7Days.slice(0, 3).map((d) => `${d.date}: ${Math.round(d.minC)}-${Math.round(d.maxC)}°C, ${Math.round(d.precipChance)}% rain (${Math.round(d.precipMm)}mm)`);
    lines.push(`- Next 3 days: ${next3.join(" | ")}`);
  } else {
    lines.push(`- No weather data available`);
  }

  lines.push(``);
  lines.push(`FARM ACTIVITIES (${ctx.activities.length})`);
  if (ctx.activities.length === 0) {
    lines.push(`- Farmer has not registered any activities yet`);
  } else {
    for (const a of ctx.activities.slice(0, 6)) {
      lines.push(`- ${a.name} (${a.type}${a.species ? `, ${a.species}` : ""}${a.size ? `, ${a.size}` : ""})${a.startDate ? `, started ${a.startDate}` : ""}`);
      if (a.upcomingTasks.length) {
        const overdueCount = a.upcomingTasks.filter((t) => t.isOverdue).length;
        const next = a.upcomingTasks[0];
        lines.push(`  next task: "${next.title}" due ${next.dueDate}${next.isOverdue ? " (OVERDUE)" : ""}${overdueCount > 1 ? ` — ${overdueCount} overdue total` : ""}`);
      }
      if (a.recentRecords.length) {
        const r = a.recentRecords[0];
        lines.push(`  last record (${r.date}): ${r.type} — ${r.description}`);
      }
    }
  }

  lines.push(``);
  lines.push(`RECENT AGRICULTURAL NEWS (${ctx.news.length})`);
  if (ctx.news.length === 0) {
    lines.push(`- No relevant news available`);
  } else {
    for (const n of ctx.news.slice(0, 4)) {
      lines.push(`- [${n.scope}] ${n.title} — ${n.summary.slice(0, 140)}... (${n.source})`);
    }
  }

  return lines.join("\n");
}

function buildFarmIntelPrompt(ctx: FarmIntelContext): string {
  const summary = summarizeContextForPrompt(ctx);
  const lang = ctx.profile.language && ctx.profile.language !== "en"
    ? `\nThe farmer's preferred language is "${ctx.profile.language}". Keep JSON keys and values in English so the app can render them, but use plain words.\n`
    : "";

  return `[INST] You are HARVEST FARM INTELLIGENCE — an automated agricultural decision engine for Kenyan and East African smallholder farmers. You are NOT a chatbot. You analyse the structured farm context below and emit a single, machine-readable JSON decision object.

${summary}
${lang}
TASK: Fuse weather + farm activities + news into actionable, region-aware farming decisions. Reference Kenyan/East African context (KALRO, KEPHIS, Kenya Met, county extension officers) where relevant.

OUTPUT — respond with ONLY valid JSON in this exact shape (no markdown fences, no surrounding text):
{
  "risk_level": "low" | "medium" | "high",
  "headline": "One short sentence summarising the most important thing the farmer should know today",
  "alerts": [
    {
      "type": "weather" | "pest" | "disease" | "market" | "general",
      "severity": "low" | "medium" | "high",
      "title": "Short title (≤60 chars)",
      "message": "Plain-English explanation in 1-2 sentences",
      "source": "weather" | "news" | "ai" | "farm"
    }
  ],
  "recommendations": [
    "Concrete actionable step 1 (irrigation, spraying, planting, harvesting, etc.)",
    "Concrete actionable step 2",
    "Concrete actionable step 3"
  ],
  "farm_actions": [
    {
      "activity": "Name of the farm activity this targets (must match one of the activities above, or 'general')",
      "action": "Specific change/task — e.g. 'Bring forward irrigation by 2 days', 'Postpone fertilizer top-dressing'",
      "due_within_days": 3
    }
  ],
  "reasoning": "2-4 plain-English sentences explaining how weather + farm data + news combined to produce the above. Mention the 1-2 strongest signals."
}

RULES:
- 1-4 alerts (most important first; only include alerts that genuinely apply)
- 2-5 recommendations
- 0-4 farm_actions (only when there's a real, specific change to make to a registered activity)
- If a data source is missing (no weather / no farm activities / no news), still produce useful output from what IS available, and mention the gap in 'reasoning'
- NEVER include greetings, sign-offs, disclaimers, markdown, or extra prose [/INST]`;
}

interface FarmIntelOutput {
  risk_level: "low" | "medium" | "high";
  headline: string;
  alerts: Array<{ type: string; severity: string; title: string; message: string; source: string }>;
  recommendations: string[];
  farm_actions: Array<{ activity: string; action: string; due_within_days?: number }>;
  reasoning: string;
}

function parseIntelJson(raw: string): FarmIntelOutput | null {
  const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const tryParse = (s: string): FarmIntelOutput | null => {
    try { return JSON.parse(s) as FarmIntelOutput; } catch { return null; }
  };
  const direct = tryParse(stripped);
  if (direct) return direct;
  const match = stripped.match(/\{[\s\S]*\}/);
  return match ? tryParse(match[0]) : null;
}

function buildHeuristicFallback(ctx: FarmIntelContext): FarmIntelOutput {
  const alerts: FarmIntelOutput["alerts"] = [];
  const recommendations: string[] = [];
  let risk: "low" | "medium" | "high" = "low";

  if (ctx.weather) {
    for (const sig of ctx.weather.derivedSignals) {
      if (sig.startsWith("dry-7")) {
        alerts.push({ type: "weather", severity: "medium", title: "Dry stretch ahead", message: "Less than 5 mm of rain forecast in the next 7 days. Plan irrigation and mulch beds.", source: "weather" });
        recommendations.push("Schedule irrigation in the next 2–3 days, prioritising young crops.");
        risk = "medium";
      } else if (sig.startsWith("heavy-rain")) {
        alerts.push({ type: "weather", severity: "high", title: "Heavy rain expected", message: "Significant rainfall in the next week. Check drainage and postpone fertiliser top-dressing.", source: "weather" });
        recommendations.push("Clear field drainage channels and protect harvested produce from moisture.");
        risk = "high";
      } else if (sig.startsWith("heat-stress")) {
        alerts.push({ type: "weather", severity: "medium", title: "Heat stress risk", message: "Multiple days at or above 32°C expected. Provide shade and water for livestock.", source: "weather" });
        recommendations.push("Irrigate early morning or evening; provide extra drinking water for livestock.");
        if (risk === "low") risk = "medium";
      }
    }
  }

  const overdue = ctx.activities.flatMap((a) => a.upcomingTasks.filter((t) => t.isOverdue));
  if (overdue.length) {
    alerts.push({
      type: "general", severity: "medium",
      title: `${overdue.length} overdue task${overdue.length > 1 ? "s" : ""}`,
      message: `Catch up on overdue activities — starting with "${overdue[0].title}".`,
      source: "farm",
    });
    recommendations.push(`Complete the overdue task "${overdue[0].title}" today.`);
    if (risk === "low") risk = "medium";
  }

  if (recommendations.length === 0) {
    recommendations.push("Continue your current routine and scout fields regularly.");
    recommendations.push("Check in with your local extension officer for region-specific advice.");
  }

  return {
    risk_level: risk,
    headline: alerts[0]?.title ?? "No urgent alerts — keep monitoring your farm.",
    alerts,
    recommendations,
    farm_actions: [],
    reasoning: "AI service was unavailable. This summary was generated locally from the latest weather signals and your farm task list.",
  };
}

async function persistAlerts(
  admin: ReturnType<typeof createClient>,
  userId: string,
  ctx: FarmIntelContext,
  intel: FarmIntelOutput,
  aiSucceeded: boolean
): Promise<void> {
  try {
    const location = `${ctx.profile.region ?? ""}|${ctx.profile.country ?? "Kenya"}`.toLowerCase();
    const rows = (intel.alerts.length > 0 ? intel.alerts : [{
      type: "general", severity: intel.risk_level, title: intel.headline, message: intel.reasoning, source: "ai",
    }]).map((a) => ({
      user_id:    userId,
      location,
      alert_type: a.type,
      severity:   a.severity,
      message:    `${a.title}: ${a.message}`,
      source:     aiSucceeded ? a.source : "fallback",
      payload:    { intelligence: intel, context_meta: { has_weather: !!ctx.weather, has_news: ctx.news.length > 0, activity_count: ctx.activities.length, generated_at: ctx.generatedAt } },
    }));
    await admin.from("farm_intelligence_alerts").insert(rows);
  } catch (e) {
    console.warn("[farm-intel] persistAlerts failed:", (e as Error).message);
  }
}

async function getRecentIntel(
  admin: ReturnType<typeof createClient>,
  userId: string
): Promise<{ intelligence: FarmIntelOutput; cachedAt: string } | null> {
  try {
    const { data } = await admin
      .from("farm_intelligence_alerts")
      .select("payload, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    const age = Date.now() - new Date(data.created_at as string).getTime();
    if (age > FARM_INTEL_CACHE_TTL_MS) return null;
    const payload = data.payload as { intelligence?: FarmIntelOutput };
    if (!payload?.intelligence) return null;
    return { intelligence: payload.intelligence, cachedAt: data.created_at as string };
  } catch { return null; }
}

async function handleFarmIntel(req: Request, body: { force?: boolean }) {
  const supabaseUrl     = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return { error: "supabase_not_configured" };
  }

  // Use the caller's JWT to identify the user (auth client validates token).
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return { error: "missing_authorization" };

  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
  if (userErr || !userData?.user) return { error: "invalid_token" };
  const userId = userData.user.id;

  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Reuse recent intel unless force-refresh requested.
  if (!body.force) {
    const cached = await getRecentIntel(admin, userId);
    if (cached) {
      return { success: true, intelligence: cached.intelligence, cachedAt: cached.cachedAt, fromCache: true };
    }
  }

  // Build context (server-side, never trusts the client)
  const ctx = await buildContext(admin, userId);

  // Call Mistral
  const prompt = buildFarmIntelPrompt(ctx);
  const aiRes  = await handleText(prompt, 1200, 0.3);

  let intel: FarmIntelOutput;
  let aiSucceeded = false;

  if ("success" in aiRes && aiRes.success && typeof aiRes.content === "string") {
    const parsed = parseIntelJson(aiRes.content);
    if (parsed && Array.isArray(parsed.alerts) && Array.isArray(parsed.recommendations)) {
      intel = parsed;
      aiSucceeded = true;
    } else {
      console.warn("[farm-intel] AI returned unparseable JSON; using heuristic fallback");
      intel = buildHeuristicFallback(ctx);
    }
  } else {
    console.warn("[farm-intel] AI call failed:", JSON.stringify(aiRes).slice(0, 200));
    intel = buildHeuristicFallback(ctx);
  }

  // Persist
  await persistAlerts(admin, userId, ctx, intel, aiSucceeded);

  return {
    success: true,
    intelligence: intel,
    aiSource: aiSucceeded ? "huggingface" : "fallback",
    contextMeta: {
      hasWeather:    !!ctx.weather,
      hasNews:       ctx.news.length > 0,
      activityCount: ctx.activities.length,
      newsCount:     ctx.news.length,
      generatedAt:   ctx.generatedAt,
      location:      ctx.weather ? `${ctx.weather.city}, ${ctx.weather.country}` : `${ctx.profile.region ?? ""}, ${ctx.profile.country ?? ""}`,
    },
  };
}

// ─── Router ───────────────────────────────────────────────────────────────────

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
    } else if (path === "farm-intel") {
      const body = await req.json().catch(() => ({}));
      result = await handleFarmIntel(req, body);
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
