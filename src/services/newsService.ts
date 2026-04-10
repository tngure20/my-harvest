/**
 * Agricultural News Service — Location-Personalised
 *
 * Fetches news at four levels of geographic specificity:
 *   1. County / Province / District  (hyper-local Guardian search)
 *   2. National                      (country-specific RSS + Guardian)
 *   3. Regional                      (East Africa / West Africa / etc.)
 *   4. Global                        (FAO, CIMMYT, CGIAR)
 *
 * Articles are tagged with their relevance level and sorted so
 * the most local content always rises to the top.
 *
 * Cache is keyed to the user's location so switching location
 * produces fresh results.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type RelevanceLevel = "county" | "national" | "regional" | "global";
export type SourceType = "local" | "national" | "international" | "research";

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  sourceType: SourceType;
  publishedAt: string;
  imageUrl?: string;
  relevanceLevel: RelevanceLevel;
  relevanceLabel: string; // human-readable: "Nakuru County", "Kenya", "East Africa", "Global"
}

export interface ParsedLocation {
  raw: string;
  county?: string;
  province?: string;
  country?: string;
  countryCode?: string;
  subregion?: string;
  primaryCrops?: string[];
}

// ─── Location Knowledge Base ──────────────────────────────────────────────────

const KENYA_COUNTIES: Record<string, { province: string; crops: string[] }> = {
  nairobi: { province: "Nairobi", crops: ["horticulture", "vegetables"] },
  mombasa: { province: "Coast", crops: ["coconut", "cashew", "fishing"] },
  kwale: { province: "Coast", crops: ["coconut", "cassava", "sugarcane"] },
  kilifi: { province: "Coast", crops: ["coconut", "cashew", "cassava"] },
  "tana river": { province: "Coast", crops: ["maize", "sorghum", "livestock"] },
  lamu: { province: "Coast", crops: ["coconut", "fishing", "mangrove"] },
  "taita-taveta": { province: "Coast", crops: ["sisal", "maize", "vegetables"] },
  garissa: { province: "North Eastern", crops: ["livestock", "camel"] },
  wajir: { province: "North Eastern", crops: ["livestock", "camel"] },
  mandera: { province: "North Eastern", crops: ["livestock", "sorghum"] },
  marsabit: { province: "Eastern", crops: ["livestock", "camel", "sorghum"] },
  isiolo: { province: "Eastern", crops: ["livestock", "cattle"] },
  meru: { province: "Eastern", crops: ["tea", "coffee", "miraa", "dairy"] },
  "tharaka-nithi": { province: "Eastern", crops: ["coffee", "sorghum", "millet"] },
  embu: { province: "Eastern", crops: ["coffee", "tea", "dairy", "maize"] },
  kitui: { province: "Eastern", crops: ["cotton", "sorghum", "maize"] },
  machakos: { province: "Eastern", crops: ["maize", "beans", "mango"] },
  makueni: { province: "Eastern", crops: ["maize", "sorghum", "mangoes", "cotton"] },
  nyandarua: { province: "Central", crops: ["wheat", "potatoes", "dairy", "pyrethrum"] },
  nyeri: { province: "Central", crops: ["coffee", "tea", "dairy", "macadamia"] },
  kirinyaga: { province: "Central", crops: ["rice", "coffee", "tea"] },
  "murang'a": { province: "Central", crops: ["coffee", "tea", "dairy", "bananas"] },
  kiambu: { province: "Central", crops: ["coffee", "tea", "horticulture", "dairy"] },
  turkana: { province: "Rift Valley", crops: ["livestock", "fishing", "sorghum"] },
  "west pokot": { province: "Rift Valley", crops: ["livestock", "sorghum", "maize"] },
  samburu: { province: "Rift Valley", crops: ["livestock", "camel"] },
  "trans-nzoia": { province: "Rift Valley", crops: ["maize", "wheat", "sunflower"] },
  "uasin gishu": { province: "Rift Valley", crops: ["maize", "wheat", "dairy", "sunflower"] },
  "elgeyo-marakwet": { province: "Rift Valley", crops: ["maize", "wheat", "vegetables"] },
  nandi: { province: "Rift Valley", crops: ["tea", "maize", "dairy"] },
  baringo: { province: "Rift Valley", crops: ["sorghum", "maize", "livestock"] },
  laikipia: { province: "Rift Valley", crops: ["livestock", "wheat", "maize"] },
  nakuru: { province: "Rift Valley", crops: ["maize", "wheat", "dairy", "pyrethrum"] },
  narok: { province: "Rift Valley", crops: ["wheat", "maize", "livestock", "tourism"] },
  kajiado: { province: "Rift Valley", crops: ["livestock", "maize", "horticulture"] },
  kericho: { province: "Rift Valley", crops: ["tea", "dairy", "maize"] },
  bomet: { province: "Rift Valley", crops: ["tea", "dairy"] },
  kakamega: { province: "Western", crops: ["sugarcane", "maize", "dairy"] },
  vihiga: { province: "Western", crops: ["tea", "maize", "dairy"] },
  bungoma: { province: "Western", crops: ["sugarcane", "maize", "dairy"] },
  busia: { province: "Western", crops: ["sugarcane", "maize", "fishing"] },
  siaya: { province: "Nyanza", crops: ["maize", "sorghum", "fishing", "cotton"] },
  kisumu: { province: "Nyanza", crops: ["maize", "fishing", "sugarcane", "rice"] },
  "homa bay": { province: "Nyanza", crops: ["maize", "sorghum", "fishing"] },
  migori: { province: "Nyanza", crops: ["maize", "sugarcane", "sorghum"] },
  kisii: { province: "Nyanza", crops: ["tea", "maize", "dairy", "bananas"] },
  nyamira: { province: "Nyanza", crops: ["tea", "maize", "dairy"] },
};

const TANZANIA_REGIONS: Record<string, { crops: string[] }> = {
  arusha: { crops: ["coffee", "maize", "wheat", "vegetables"] },
  kilimanjaro: { crops: ["coffee", "maize", "banana", "dairy"] },
  moshi: { crops: ["coffee", "banana", "maize"] },
  "dar es salaam": { crops: ["vegetables", "fishing"] },
  mwanza: { crops: ["cotton", "fishing", "maize"] },
  dodoma: { crops: ["grapes", "sunflower", "maize", "sorghum"] },
  morogoro: { crops: ["rice", "maize", "sugarcane"] },
  mbeya: { crops: ["coffee", "tea", "maize", "wheat"] },
  kagera: { crops: ["coffee", "banana", "tea"] },
  zanzibar: { crops: ["cloves", "coconut", "seaweed"] },
};

const UGANDA_DISTRICTS: Record<string, { crops: string[] }> = {
  kampala: { crops: ["vegetables", "poultry"] },
  wakiso: { crops: ["matooke", "coffee", "dairy"] },
  jinja: { crops: ["sugarcane", "maize", "fishing"] },
  gulu: { crops: ["sesame", "sorghum", "maize"] },
  mbarara: { crops: ["dairy", "matooke", "beans"] },
  mbale: { crops: ["coffee", "maize", "rice"] },
  lira: { crops: ["cotton", "maize", "sorghum"] },
  soroti: { crops: ["cassava", "sorghum", "cotton"] },
};

const ETHIOPIA_REGIONS: Record<string, { crops: string[] }> = {
  "addis ababa": { crops: ["vegetables", "dairy"] },
  oromia: { crops: ["coffee", "maize", "teff", "sorghum"] },
  "snnp": { crops: ["coffee", "enset", "sugarcane"] },
  amhara: { crops: ["teff", "wheat", "barley", "sorghum"] },
  tigray: { crops: ["teff", "sorghum", "barley"] },
  afar: { crops: ["livestock", "camel"] },
  "dire dawa": { crops: ["livestock", "maize"] },
};

interface CountryConfig {
  name: string;
  subregion: string;
  feeds: Array<{ url: string; source: string; type: SourceType }>;
  fallback: Array<Omit<NewsItem, "id">>;
}

const COUNTRY_CONFIG: Record<string, CountryConfig> = {
  KE: {
    name: "Kenya",
    subregion: "East Africa",
    feeds: [
      { url: "https://farmerstrend.co.ke/feed/", source: "Farmers Trend Kenya", type: "national" },
    ],
    fallback: [
      {
        title: "KALRO: New high-yielding maize varieties distributed across Kenya's highlands",
        summary: "Kenya Agricultural & Livestock Research Organization has released HB614D and H614D Plus maize varieties showing 30% better yields in highland conditions.",
        url: "https://www.kalro.org/news/",
        source: "KALRO",
        sourceType: "national",
        publishedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        relevanceLevel: "national",
        relevanceLabel: "Kenya",
      },
      {
        title: "KEPHIS Fall Armyworm Seasonal Alert: Scout your maize fields",
        summary: "Kenya Plant Health Inspectorate Service urges farmers to increase weekly scouting. Early detection and use of approved pesticides can prevent up to 70% crop loss.",
        url: "https://www.kephis.org/",
        source: "KEPHIS",
        sourceType: "national",
        publishedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
        relevanceLevel: "national",
        relevanceLabel: "Kenya",
      },
      {
        title: "Kenya Dairy Board: Milk prices stabilise ahead of long rains season",
        summary: "Raw milk farmgate prices have stabilised at KSh 40–45 per litre across Central and Rift Valley counties as grass flush approaches.",
        url: "https://www.kdb.co.ke/",
        source: "Kenya Dairy Board",
        sourceType: "national",
        publishedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
        relevanceLevel: "national",
        relevanceLabel: "Kenya",
      },
    ],
  },
  TZ: {
    name: "Tanzania",
    subregion: "East Africa",
    feeds: [
      { url: "https://www.thecitizen.co.tz/feed/", source: "The Citizen Tanzania", type: "national" },
    ],
    fallback: [
      {
        title: "TARI releases drought-tolerant sorghum varieties for central Tanzania",
        summary: "Tanzania Agricultural Research Institute has released two new sorghum varieties suited to the dry central zone, with 25% better drought tolerance.",
        url: "https://www.tari.go.tz/",
        source: "TARI",
        sourceType: "national",
        publishedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
        relevanceLevel: "national",
        relevanceLabel: "Tanzania",
      },
      {
        title: "Tanzania: Cashew nut export earnings projected to hit $400M this season",
        summary: "The Tanzania Cashewnut Board reports strong global demand, with South Asian buyers committing early. Farmers advised to hold stocks for better prices.",
        url: "https://www.tcb.go.tz/",
        source: "Tanzania Cashewnut Board",
        sourceType: "national",
        publishedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
        relevanceLevel: "national",
        relevanceLabel: "Tanzania",
      },
    ],
  },
  UG: {
    name: "Uganda",
    subregion: "East Africa",
    feeds: [
      { url: "https://www.monitor.co.ug/feed/", source: "Daily Monitor Uganda", type: "national" },
    ],
    fallback: [
      {
        title: "NARO Uganda: Improved banana varieties resistant to Banana Xanthomonas Wilt released",
        summary: "National Agricultural Research Organisation has distributed over 2 million tissue culture banana plantlets resistant to BXW disease in Buganda and Western regions.",
        url: "https://www.naro.go.ug/",
        source: "NARO Uganda",
        sourceType: "national",
        publishedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
        relevanceLevel: "national",
        relevanceLabel: "Uganda",
      },
      {
        title: "Uganda: Coffee export earnings rise 18% as global prices improve",
        summary: "Uganda Coffee Development Authority reports record earnings, with Robusta from Bugisu and Arabica from Mt Elgon commanding premium prices in European markets.",
        url: "https://www.ucda.co.ug/",
        source: "UCDA",
        sourceType: "national",
        publishedAt: new Date(Date.now() - 6 * 86400000).toISOString(),
        relevanceLevel: "national",
        relevanceLabel: "Uganda",
      },
    ],
  },
  ET: {
    name: "Ethiopia",
    subregion: "East Africa",
    feeds: [],
    fallback: [
      {
        title: "Ethiopian Coffee and Tea Authority: Record arabica harvest forecast for Sidama and Yirgacheffe",
        summary: "Ideal growing conditions and expanded smallholder cultivation area expected to push Ethiopia's coffee production above 500,000 metric tonnes.",
        url: "https://www.ecta.gov.et/",
        source: "Ethiopian CTA",
        sourceType: "national",
        publishedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
        relevanceLevel: "national",
        relevanceLabel: "Ethiopia",
      },
    ],
  },
  RW: {
    name: "Rwanda",
    subregion: "East Africa",
    feeds: [],
    fallback: [
      {
        title: "RAB Rwanda: New potato varieties combat late blight on Virunga slopes",
        summary: "Rwanda Agriculture and Animal Resources Development Board distributes 500 tonnes of Kinigi and Kirundo certified potato seed to Northern Province farmers.",
        url: "https://www.rab.gov.rw/",
        source: "RAB Rwanda",
        sourceType: "national",
        publishedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
        relevanceLevel: "national",
        relevanceLabel: "Rwanda",
      },
    ],
  },
  NG: {
    name: "Nigeria",
    subregion: "West Africa",
    feeds: [
      { url: "https://www.thisdaylive.com/category/agriculture/feed/", source: "ThisDay Nigeria", type: "national" },
    ],
    fallback: [
      {
        title: "NIRSAL: Agric financing for smallholders expanded to 20 new states",
        summary: "Nigeria Incentive-Based Risk Sharing System for Agricultural Lending reports record loan disbursements, with rice and cassava farmers receiving priority access.",
        url: "https://www.nirsal.com/",
        source: "NIRSAL",
        sourceType: "national",
        publishedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
        relevanceLevel: "national",
        relevanceLabel: "Nigeria",
      },
    ],
  },
  GH: {
    name: "Ghana",
    subregion: "West Africa",
    feeds: [],
    fallback: [
      {
        title: "MoFA Ghana: Planting for Food and Jobs season 3 fertiliser distribution begins",
        summary: "Ministry of Food and Agriculture begins nationwide distribution of subsidised fertiliser and improved seeds under the PFJ programme ahead of the major season.",
        url: "https://mofa.gov.gh/",
        source: "MoFA Ghana",
        sourceType: "national",
        publishedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
        relevanceLevel: "national",
        relevanceLabel: "Ghana",
      },
    ],
  },
  ZA: {
    name: "South Africa",
    subregion: "Southern Africa",
    feeds: [
      { url: "https://www.farmersweekly.co.za/feed/", source: "Farmer's Weekly SA", type: "national" },
    ],
    fallback: [
      {
        title: "SACGA: South African sugarcane industry targets 22 million tonnes this harvest",
        summary: "South African Cane Growers' Association reports improved moisture conditions in KwaZulu-Natal. Small-scale growers receiving expanded extension support.",
        url: "https://www.sacga.co.za/",
        source: "SACGA",
        sourceType: "national",
        publishedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
        relevanceLevel: "national",
        relevanceLabel: "South Africa",
      },
    ],
  },
};

const EAST_AFRICA_CODES = new Set(["KE", "TZ", "UG", "ET", "RW", "BI", "SS", "SO", "DJ", "ER"]);
const WEST_AFRICA_CODES = new Set(["NG", "GH", "SN", "CI", "ML", "BF", "NE", "GN", "SL", "LR"]);
const SOUTHERN_AFRICA_CODES = new Set(["ZA", "ZW", "ZM", "MW", "MZ", "BW", "NA", "LS", "SZ"]);

// ─── Location Parser ──────────────────────────────────────────────────────────

const COUNTRY_ALIASES: Record<string, string> = {
  kenya: "KE", ke: "KE",
  tanzania: "TZ", tz: "TZ",
  uganda: "UG", ug: "UG",
  ethiopia: "ET", et: "ET", abyssinia: "ET",
  rwanda: "RW", rw: "RW",
  burundi: "BI", bi: "BI",
  nigeria: "NG", ng: "NG",
  ghana: "GH", gh: "GH",
  "south africa": "ZA", za: "ZA", "s.africa": "ZA",
  zimbabwe: "ZW", zw: "ZW",
  zambia: "ZM", zm: "ZM",
  malawi: "MW", mw: "MW",
  mozambique: "MZ", mz: "MZ",
  botswana: "BW", bw: "BW",
  namibia: "NA", na: "NA",
  senegal: "SN", sn: "SN",
  "ivory coast": "CI", "cote d'ivoire": "CI",
  mali: "ML", ml: "ML",
};

// Cities that imply a country code
const CITY_TO_COUNTRY: Record<string, string> = {
  nairobi: "KE", nakuru: "KE", kisumu: "KE", mombasa: "KE", eldoret: "KE",
  thika: "KE", nyeri: "KE", kericho: "KE", nanyuki: "KE", machakos: "KE",
  "dar es salaam": "TZ", arusha: "TZ", mwanza: "TZ", dodoma: "TZ", zanzibar: "TZ",
  kampala: "UG", gulu: "UG", jinja: "UG", mbarara: "UG", mbale: "UG",
  "addis ababa": "ET", awash: "ET", dire: "ET", mekele: "ET",
  kigali: "RW", butare: "RW", musanze: "RW",
  lagos: "NG", abuja: "NG", kano: "NG", ibadan: "NG", "port harcourt": "NG",
  accra: "GH", kumasi: "GH", tamale: "GH",
  johannesburg: "ZA", capetown: "ZA", "cape town": "ZA", durban: "ZA", pretoria: "ZA",
};

export function parseLocation(raw: string): ParsedLocation {
  if (!raw?.trim()) return { raw: "" };

  const lower = raw.toLowerCase().trim();
  const parts = lower.split(/[,\/\-\s]+/).map(p => p.trim()).filter(Boolean);

  // Detect country code
  let countryCode: string | undefined;
  let country: string | undefined;

  // Try full string match and individual parts
  for (const alias of [lower, ...parts]) {
    if (COUNTRY_ALIASES[alias]) {
      countryCode = COUNTRY_ALIASES[alias];
      country = COUNTRY_CONFIG[countryCode]?.name ?? alias;
      break;
    }
  }
  if (!countryCode) {
    for (const part of parts) {
      if (CITY_TO_COUNTRY[part]) {
        countryCode = CITY_TO_COUNTRY[part];
        country = COUNTRY_CONFIG[countryCode]?.name;
        break;
      }
    }
  }

  // Detect county/district/province
  let county: string | undefined;
  let province: string | undefined;
  let primaryCrops: string[] | undefined;

  if (countryCode === "KE") {
    // Try each segment as a Kenya county
    for (const part of parts) {
      // exact and contains match
      const key = Object.keys(KENYA_COUNTIES).find(k => k === part || part.includes(k) || k.includes(part));
      if (key) {
        county = key.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        province = KENYA_COUNTIES[key].province;
        primaryCrops = KENYA_COUNTIES[key].crops;
        break;
      }
    }
  } else if (countryCode === "TZ") {
    for (const part of parts) {
      const key = Object.keys(TANZANIA_REGIONS).find(k => k === part || part.includes(k));
      if (key) {
        county = key.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        primaryCrops = TANZANIA_REGIONS[key].crops;
        break;
      }
    }
  } else if (countryCode === "UG") {
    for (const part of parts) {
      const key = Object.keys(UGANDA_DISTRICTS).find(k => k === part || part.includes(k));
      if (key) {
        county = key.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        primaryCrops = UGANDA_DISTRICTS[key].crops;
        break;
      }
    }
  } else if (countryCode === "ET") {
    for (const part of parts) {
      const key = Object.keys(ETHIOPIA_REGIONS).find(k => k === part || part.includes(k));
      if (key) {
        county = key.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        primaryCrops = ETHIOPIA_REGIONS[key].crops;
        break;
      }
    }
  }

  // Derive subregion
  let subregion: string | undefined;
  if (countryCode) {
    if (EAST_AFRICA_CODES.has(countryCode)) subregion = "East Africa";
    else if (WEST_AFRICA_CODES.has(countryCode)) subregion = "West Africa";
    else if (SOUTHERN_AFRICA_CODES.has(countryCode)) subregion = "Southern Africa";
    else subregion = "Africa";
  }

  return { raw, county, province, country, countryCode, subregion, primaryCrops };
}

// ─── Cache (location-keyed) ───────────────────────────────────────────────────

const CACHE_TTL = 30 * 60 * 1000;

function cacheKey(location: string) {
  return `harvest_news_${location.toLowerCase().replace(/\W+/g, "_").slice(0, 40)}`;
}

interface CacheEntry { data: NewsItem[]; ts: number }

function readCache(location: string): NewsItem[] | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(location));
    if (!raw) return null;
    const e: CacheEntry = JSON.parse(raw);
    if (Date.now() - e.ts > CACHE_TTL) return null;
    return e.data;
  } catch { return null; }
}

function writeCache(location: string, data: NewsItem[]) {
  try {
    sessionStorage.setItem(cacheKey(location), JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

// ─── Guardian API ─────────────────────────────────────────────────────────────

async function guardianSearch(
  query: string,
  level: RelevanceLevel,
  label: string,
  count = 5
): Promise<NewsItem[]> {
  const url =
    `https://content.guardianapis.com/search` +
    `?q=${encodeURIComponent(query)}` +
    `&format=json&api-key=test` +
    `&page-size=${count}` +
    `&show-fields=trailText,thumbnail` +
    `&order-by=newest`;

  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Guardian ${res.status}`);
  const data = await res.json();

  return (data?.response?.results ?? []).map((item: Record<string, unknown>, i: number) => {
    const f = (item.fields as Record<string, string>) ?? {};
    return {
      id: `g-${level}-${i}-${String(item.id ?? "").slice(-8)}`,
      title: String(item.webTitle ?? ""),
      summary: String(f.trailText ?? ""),
      url: String(item.webUrl ?? ""),
      source: "The Guardian",
      sourceType: "international" as SourceType,
      publishedAt: String(item.webPublicationDate ?? new Date().toISOString()),
      imageUrl: f.thumbnail || undefined,
      relevanceLevel: level,
      relevanceLabel: label,
    };
  });
}

// ─── RSS2JSON ─────────────────────────────────────────────────────────────────

interface RssItem {
  title?: string; description?: string; link?: string;
  pubDate?: string; thumbnail?: string;
  enclosure?: { link?: string };
}

async function fetchRSS(
  rssUrl: string,
  source: string,
  sourceType: SourceType,
  level: RelevanceLevel,
  label: string,
  count = 5
): Promise<NewsItem[]> {
  const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`rss2json ${res.status}`);
  const data = await res.json();
  if (data.status !== "ok") throw new Error("rss2json: " + data.status);

  return (data.items ?? []).map((item: RssItem, i: number) => ({
    id: `rss-${source.toLowerCase().replace(/\W+/g, "-")}-${i}`,
    title: String(item.title ?? ""),
    summary: (item.description ?? "").replace(/<[^>]+>/g, "").trim().slice(0, 220),
    url: String(item.link ?? ""),
    source,
    sourceType,
    publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
    imageUrl: item.thumbnail || item.enclosure?.link || undefined,
    relevanceLevel: level,
    relevanceLabel: label,
  }));
}

// ─── Global sources ───────────────────────────────────────────────────────────

const GLOBAL_FALLBACK: NewsItem[] = [
  {
    id: "gf-1",
    title: "FAO: World food price index eases for third consecutive month",
    summary: "The FAO Food Price Index fell 1.3% in the latest reading, driven by lower sugar, dairy and vegetable oil prices, offering relief to import-dependent nations.",
    url: "https://www.fao.org/news/story/en/",
    source: "FAO", sourceType: "international",
    publishedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    relevanceLevel: "global", relevanceLabel: "Global",
  },
  {
    id: "gf-2",
    title: "CIMMYT: Drought-tolerant maize seed adoption doubles across Sub-Saharan Africa",
    summary: "Adoption of improved drought-tolerant and disease-resistant maize varieties has doubled in five years, reaching over 8 million smallholder households.",
    url: "https://www.cimmyt.org/news/",
    source: "CIMMYT", sourceType: "research",
    publishedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    relevanceLevel: "global", relevanceLabel: "Global",
  },
  {
    id: "gf-3",
    title: "CGIAR: Climate-resilient crop varieties now available in 40 countries",
    summary: "CGIAR research centres have released over 300 improved varieties in the past two years, combining heat tolerance, early maturity and disease resistance.",
    url: "https://www.cgiar.org/news-events/news/",
    source: "CGIAR", sourceType: "research",
    publishedAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    relevanceLevel: "global", relevanceLabel: "Global",
  },
  {
    id: "gf-4",
    title: "ILRI: Livestock vaccine access improves for East African smallholders",
    summary: "Expanded cold-chain infrastructure and mobile veterinary units are improving vaccine coverage for foot-and-mouth, Rift Valley fever and lumpy skin disease.",
    url: "https://www.ilri.org/news",
    source: "ILRI", sourceType: "research",
    publishedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    relevanceLevel: "regional", relevanceLabel: "East Africa",
  },
  {
    id: "gf-5",
    title: "World Bank: $2.5B approved for climate-smart agriculture in Sub-Saharan Africa",
    summary: "New financing will support sustainable soil management, water harvesting, and market access for over 4 million smallholder farmers across 12 countries.",
    url: "https://www.worldbank.org/en/topic/agriculture",
    source: "World Bank", sourceType: "international",
    publishedAt: new Date(Date.now() - 9 * 86400000).toISOString(),
    relevanceLevel: "global", relevanceLabel: "Global",
  },
];

// ─── Deduplicate ──────────────────────────────────────────────────────────────

function deduplicate(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const k = item.title.toLowerCase().replace(/\W+/g, "").slice(0, 35);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ─── Sort by relevance level ──────────────────────────────────────────────────

const LEVEL_RANK: Record<RelevanceLevel, number> = { county: 0, national: 1, regional: 2, global: 3 };

function sortByRelevance(items: NewsItem[]): NewsItem[] {
  return [...items].sort((a, b) => {
    const levelDiff = LEVEL_RANK[a.relevanceLevel] - LEVEL_RANK[b.relevanceLevel];
    if (levelDiff !== 0) return levelDiff;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function fetchAgriNews(rawLocation = ""): Promise<NewsItem[]> {
  const loc = parseLocation(rawLocation);
  const cacheKeyStr = rawLocation || "global";

  const cached = readCache(cacheKeyStr);
  if (cached) return cached;

  const tasks: Promise<NewsItem[]>[] = [];

  // ── 1. County / district level (hyper-local) ────────────────────────────────
  if (loc.county && loc.country) {
    const crops = (loc.primaryCrops ?? []).slice(0, 2).join(" ");
    const countyLabel = loc.province ? `${loc.county}, ${loc.province}` : loc.county;
    tasks.push(
      guardianSearch(
        `${loc.county} ${loc.country} agriculture farming ${crops}`,
        "county", countyLabel, 4
      ).catch(() => [])
    );
  }

  // ── 2. National level ───────────────────────────────────────────────────────
  if (loc.country && loc.countryCode) {
    const label = loc.country;
    tasks.push(
      guardianSearch(
        `${loc.country} agriculture farming food crops`,
        "national", label, 5
      ).catch(() => [])
    );

    const config = COUNTRY_CONFIG[loc.countryCode];
    if (config) {
      for (const feed of config.feeds) {
        tasks.push(
          fetchRSS(feed.url, feed.source, feed.type, "national", label, 5).catch(() => [])
        );
      }
    }
  }

  // ── 3. Regional level (East Africa, West Africa, etc.) ─────────────────────
  if (loc.subregion) {
    tasks.push(
      guardianSearch(
        `${loc.subregion} agriculture farming food`,
        "regional", loc.subregion, 4
      ).catch(() => [])
    );
    tasks.push(
      fetchRSS("https://www.cimmyt.org/feed/", "CIMMYT", "research", "regional", loc.subregion, 4)
        .catch(() => [])
    );
  }

  // ── 4. Global level ─────────────────────────────────────────────────────────
  tasks.push(
    guardianSearch("agriculture farming food crops global", "global", "Global", 4).catch(() => []),
    fetchRSS(
      "https://www.fao.org/rss/en/news-releases-detail.xml",
      "FAO", "international", "global", "Global", 5
    ).catch(() => [])
  );

  const settled = await Promise.allSettled(tasks);
  const results: NewsItem[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") results.push(...r.value);
  }

  // Merge country fallback articles if national fetch returned few items
  const national = results.filter(i => i.relevanceLevel === "national");
  if (national.length < 2 && loc.countryCode && COUNTRY_CONFIG[loc.countryCode]) {
    const fb = COUNTRY_CONFIG[loc.countryCode].fallback.map((item, idx) => ({
      ...item, id: `fb-nat-${idx}`,
    }));
    results.push(...fb);
  }

  // Always ensure global fallback
  const global = results.filter(i => i.relevanceLevel === "global");
  if (global.length < 2) {
    results.push(...GLOBAL_FALLBACK.filter(f => f.relevanceLevel === "global"));
  }

  // Always include regional ILRI item
  if (!results.some(i => i.relevanceLevel === "regional")) {
    results.push(...GLOBAL_FALLBACK.filter(f => f.relevanceLevel === "regional"));
  }

  const final = sortByRelevance(deduplicate(results));
  writeCache(cacheKeyStr, final);
  return final;
}

export function clearNewsCache(rawLocation = "") {
  if (rawLocation) {
    sessionStorage.removeItem(cacheKey(rawLocation));
  } else {
    // Clear all news cache keys
    Object.keys(sessionStorage)
      .filter(k => k.startsWith("harvest_news_"))
      .forEach(k => sessionStorage.removeItem(k));
  }
}
