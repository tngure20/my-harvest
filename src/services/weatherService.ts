/**
 * Weather & Location Service
 * ──────────────────────────────────────────────────────────────────
 * Detects the user's location via browser geolocation + OpenStreetMap
 * reverse geocoding, then fetches current weather from wttr.in
 * (no API key required).
 *
 * Results are cached for 30 minutes in localStorage.
 */

export interface WeatherContext {
  location: string;
  county?: string;
  country: string;
  latitude?: number;
  longitude?: number;
  temperature: number;
  feelsLike: number;
  humidity: number;
  description: string;
  season: string;
  rainMm: number;
}

const CACHE_KEY = "harvest_weather_ctx_v1";
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ─── Season derivation ────────────────────────────────────────────────────────

function getKenyanSeason(month: number): string {
  if (month >= 3 && month <= 5)   return "long rains (March–May)";
  if (month >= 6 && month <= 9)   return "long dry season (June–September)";
  if (month >= 10 && month <= 12) return "short rains (October–December)";
  return "short dry season (January–February)";
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

function getCachedWeather(): WeatherContext | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ctx, expiresAt } = JSON.parse(raw) as { ctx: WeatherContext; expiresAt: number };
    if (Date.now() > expiresAt) { localStorage.removeItem(CACHE_KEY); return null; }
    return ctx;
  } catch { return null; }
}

function cacheWeather(ctx: WeatherContext): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ctx, expiresAt: Date.now() + CACHE_TTL }));
  } catch { /* storage quota — non-fatal */ }
}

// ─── Location detection ───────────────────────────────────────────────────────

async function getBrowserCoordinates(): Promise<{ lat: number; lon: number } | null> {
  if (!navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 6_000, maximumAge: 300_000 }
    );
  });
}

async function reverseGeocode(lat: number, lon: number): Promise<{
  city: string;
  county?: string;
  country: string;
}> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      {
        headers: { "Accept-Language": "en", "User-Agent": "HarvestApp/1.0" },
        signal: AbortSignal.timeout(6_000),
      }
    );
    if (!res.ok) return { city: "Nairobi", country: "Kenya" };
    const data = await res.json() as {
      address?: {
        city?: string; town?: string; village?: string;
        county?: string; state?: string; country?: string;
      };
    };
    const addr = data.address ?? {};
    return {
      city:    addr.city || addr.town || addr.village || addr.county || "Nairobi",
      county:  addr.county || addr.state,
      country: addr.country || "Kenya",
    };
  } catch {
    return { city: "Nairobi", country: "Kenya" };
  }
}

// ─── Weather fetch ────────────────────────────────────────────────────────────

interface WttrCurrent {
  temp_C?: string;
  FeelsLikeC?: string;
  humidity?: string;
  precipMM?: string;
  weatherDesc?: { value: string }[];
}

async function fetchWttr(location: string): Promise<{
  temp: number;
  feelsLike: number;
  humidity: number;
  rainMm: number;
  description: string;
} | null> {
  try {
    const res = await fetch(
      `https://wttr.in/${encodeURIComponent(location)}?format=j1`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json() as { current_condition?: WttrCurrent[] };
    const c = data.current_condition?.[0];
    if (!c) return null;
    return {
      temp:        parseFloat(c.temp_C ?? "22")       || 22,
      feelsLike:   parseFloat(c.FeelsLikeC ?? "22")   || 22,
      humidity:    parseInt(c.humidity ?? "60")         || 60,
      rainMm:      parseFloat(c.precipMM ?? "0")       || 0,
      description: c.weatherDesc?.[0]?.value           ?? "Partly cloudy",
    };
  } catch {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch and cache the user's weather + location context.
 * Never throws — returns null if detection fails completely.
 */
export async function getWeatherContext(): Promise<WeatherContext | null> {
  const cached = getCachedWeather();
  if (cached) return cached;

  try {
    let city    = "Nairobi";
    let country = "Kenya";
    let county: string | undefined;
    let coords: { lat: number; lon: number } | null = null;

    // 1. Manual override (set by user in Settings) takes precedence
    let manual: { country: string; region: string } | null = null;
    try {
      const raw = localStorage.getItem("harvest_manual_location_v1");
      if (raw) manual = JSON.parse(raw);
    } catch { /* ignore */ }

    if (manual?.region) {
      city = manual.region;
      country = manual.country || country;
    } else {
      // 2. Browser geolocation + reverse geocode
      coords = await getBrowserCoordinates();
      if (coords) {
        const geo = await reverseGeocode(coords.lat, coords.lon);
        city    = geo.city;
        country = geo.country;
        county  = geo.county;
      }
    }

    // Fetch weather (non-blocking failure) — query "city,country" for accuracy
    const weatherQuery = manual?.region ? `${city},${country}` : city;
    const weather = await fetchWttr(weatherQuery);
    const month   = new Date().getMonth() + 1;

    const ctx: WeatherContext = {
      location:    city,
      county,
      country,
      latitude:    coords?.lat,
      longitude:   coords?.lon,
      temperature: weather?.temp        ?? 22,
      feelsLike:   weather?.feelsLike   ?? 22,
      humidity:    weather?.humidity    ?? 60,
      description: weather?.description ?? "Partly cloudy",
      season:      getKenyanSeason(month),
      rainMm:      weather?.rainMm      ?? 0,
    };

    cacheWeather(ctx);
    return ctx;
  } catch {
    return null;
  }
}

/**
 * Format weather context as a concise string for prompt injection.
 */
export function weatherToPromptString(ctx: WeatherContext): string {
  const parts = [
    `Location: ${ctx.location}${ctx.county ? `, ${ctx.county}` : ""}, ${ctx.country}`,
    `Temperature: ${ctx.temperature}°C (feels like ${ctx.feelsLike}°C)`,
    `Current weather: ${ctx.description}`,
    `Humidity: ${ctx.humidity}%`,
    `Season: ${ctx.season}`,
  ];
  if (ctx.rainMm > 0) parts.push(`Recent rainfall: ${ctx.rainMm}mm`);
  return parts.join(". ");
}

/** Clear the cached weather data (e.g., for testing or location change) */
export function clearWeatherCache(): void {
  localStorage.removeItem(CACHE_KEY);
}
