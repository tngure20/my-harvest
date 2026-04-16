/**
 * Embedding Service
 * ──────────────────────────────────────────────────────────────────
 * Generates vector embeddings via HuggingFace sentence-transformers.
 * Supports single-text and batch embedding with long-lived caching.
 *
 * Model: sentence-transformers/all-MiniLM-L6-v2
 * Produces 384-dimensional float vectors.
 */

import type { CorpusEntry } from "@/lib/agricultureKnowledge";

const EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const HF_BASE     = "https://api-inference.huggingface.co";

/** 24-hour TTL for corpus embeddings (rarely change) */
const CORPUS_CACHE_TTL  = 24 * 60 * 60 * 1000;
/** 1-hour TTL for individual query embeddings */
const QUERY_CACHE_TTL   = 60 * 60 * 1000;
const CORPUS_CACHE_KEY  = "harvest_corpus_emb_v1";

// ─── Cosine Similarity ────────────────────────────────────────────────────────

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── Query embedding cache (in-memory) ───────────────────────────────────────

const _queryCache = new Map<string, { vector: number[]; expiresAt: number }>();

function getCachedQuery(text: string): number[] | null {
  const key = text.slice(0, 128);
  const entry = _queryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { _queryCache.delete(key); return null; }
  return entry.vector;
}

function setCachedQuery(text: string, vector: number[]): void {
  _queryCache.set(text.slice(0, 128), { vector, expiresAt: Date.now() + QUERY_CACHE_TTL });
}

// ─── Corpus embedding cache (localStorage) ────────────────────────────────────

interface CorpusEmbeddingCache {
  ids: string[];
  vectors: number[][];
  expiresAt: number;
}

function getCorpusCache(): CorpusEmbeddingCache | null {
  try {
    const raw = localStorage.getItem(CORPUS_CACHE_KEY);
    if (!raw) return null;
    const data: CorpusEmbeddingCache = JSON.parse(raw);
    if (Date.now() > data.expiresAt) { localStorage.removeItem(CORPUS_CACHE_KEY); return null; }
    return data;
  } catch { return null; }
}

function setCorpusCache(ids: string[], vectors: number[][]): void {
  try {
    const data: CorpusEmbeddingCache = { ids, vectors, expiresAt: Date.now() + CORPUS_CACHE_TTL };
    localStorage.setItem(CORPUS_CACHE_KEY, JSON.stringify(data));
  } catch { /* storage quota — non-fatal */ }
}

// ─── HuggingFace API calls ────────────────────────────────────────────────────

async function callEmbedAPI(inputs: string | string[], apiKey: string): Promise<number[][]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch(`${HF_BASE}/models/${EMBED_MODEL}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ inputs, options: { wait_for_model: true } }),
      signal: controller.signal,
    });

    if (res.status === 503) {
      const body = await res.json().catch(() => ({})) as { estimated_time?: number };
      throw new Error(`Embed model loading (${body.estimated_time ? Math.ceil(body.estimated_time) + "s" : "~20s"})`);
    }
    if (!res.ok) throw new Error(`Embed API ${res.status}`);

    const data = await res.json() as number[] | number[][];
    // Normalise to 2D array regardless of whether input was single or batch
    if (Array.isArray(data[0]) && Array.isArray((data[0] as number[])[0])) {
      // Nested 3D: sentence-transformers sometimes returns [[[...]]]
      return (data as number[][][]).map((d) => d[0]);
    }
    if (typeof data[0] === "number") {
      // Single vector returned as flat 1D
      return [data as number[]];
    }
    return data as number[][];
  } finally {
    clearTimeout(timer);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Embed a single query string. Cached in memory for 1 hour.
 */
export async function embedQuery(text: string, apiKey: string): Promise<number[]> {
  const cached = getCachedQuery(text);
  if (cached) return cached;

  const vectors = await callEmbedAPI(text, apiKey);
  const vector = vectors[0];
  setCachedQuery(text, vector);
  return vector;
}

/**
 * Get or compute embeddings for the full knowledge corpus.
 * Uses a batch API call and caches in localStorage for 24 hours.
 * On cache miss: 1 API call for all N entries (efficient).
 */
export async function getCorpusEmbeddings(
  corpus: CorpusEntry[],
  apiKey: string
): Promise<{ id: string; vector: number[] }[]> {
  const cached = getCorpusCache();

  if (cached && cached.ids.length === corpus.length) {
    return corpus.map((entry, i) => ({ id: entry.id, vector: cached.vectors[i] }));
  }

  // Batch embed all corpus entries in one API call
  const texts = corpus.map((e) => e.text);
  const vectors = await callEmbedAPI(texts, apiKey);

  const ids = corpus.map((e) => e.id);
  setCorpusCache(ids, vectors);

  return corpus.map((entry, i) => ({ id: entry.id, vector: vectors[i] }));
}

/**
 * Find the top-K most semantically similar corpus entries to the query.
 */
export async function retrieveTopK(
  query: string,
  corpus: CorpusEntry[],
  apiKey: string,
  topK = 3
): Promise<CorpusEntry[]> {
  const [queryVector, corpusEmbeddings] = await Promise.all([
    embedQuery(query, apiKey),
    getCorpusEmbeddings(corpus, apiKey),
  ]);

  const scored = corpusEmbeddings.map(({ id, vector }) => ({
    id,
    similarity: cosineSimilarity(queryVector, vector),
  }));

  scored.sort((a, b) => b.similarity - a.similarity);
  const topIds = new Set(scored.slice(0, topK).map((s) => s.id));
  return corpus.filter((e) => topIds.has(e.id));
}

/** Clear all embedding caches (useful after knowledge base updates) */
export function clearEmbeddingCache(): void {
  _queryCache.clear();
  localStorage.removeItem(CORPUS_CACHE_KEY);
}
