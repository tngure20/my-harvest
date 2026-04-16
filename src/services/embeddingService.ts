/**
 * Embedding Service
 * ──────────────────────────────────────────────────────────────────
 * Generates vector embeddings via the ai-gateway edge function.
 * No API keys are used in the frontend.
 *
 * Model: sentence-transformers/all-MiniLM-L6-v2
 * Produces 384-dimensional float vectors.
 */

import type { CorpusEntry } from "@/lib/agricultureKnowledge";
import { supabase } from "@/services/supabaseClient";

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

// ─── Backend API call ─────────────────────────────────────────────────────────

async function callEmbedAPI(inputs: string | string[]): Promise<number[][]> {
  const { data, error } = await supabase.functions.invoke("ai-gateway/embed", {
    body: { inputs },
  });

  if (error) throw new Error(`Embed gateway error: ${error.message}`);
  if (data?.error) {
    if (data.error === "model_loading") throw new Error(`Embed model loading (~${data.estimated_time || 20}s)`);
    throw new Error(`Embed backend: ${data.error}`);
  }

  const embeddings = data?.embeddings;
  if (!embeddings) throw new Error("No embeddings returned");

  // Normalise to 2D array
  if (Array.isArray(embeddings[0]) && Array.isArray((embeddings[0] as number[])[0])) {
    return (embeddings as unknown as number[][][]).map((d: number[][]) => d[0]);
  }
  if (typeof embeddings[0] === "number") {
    return [embeddings as number[]];
  }
  return embeddings as number[][];
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function embedQuery(text: string): Promise<number[]> {
  const cached = getCachedQuery(text);
  if (cached) return cached;

  const vectors = await callEmbedAPI(text);
  const vector = vectors[0];
  setCachedQuery(text, vector);
  return vector;
}

export async function getCorpusEmbeddings(
  corpus: CorpusEntry[]
): Promise<{ id: string; vector: number[] }[]> {
  const cached = getCorpusCache();

  if (cached && cached.ids.length === corpus.length) {
    return corpus.map((entry, i) => ({ id: entry.id, vector: cached.vectors[i] }));
  }

  const texts = corpus.map((e) => e.text);
  const vectors = await callEmbedAPI(texts);

  const ids = corpus.map((e) => e.id);
  setCorpusCache(ids, vectors);

  return corpus.map((entry, i) => ({ id: entry.id, vector: vectors[i] }));
}

/**
 * Find the top-K most semantically similar corpus entries to the query.
 * No API key needed — calls go through the backend edge function.
 */
export async function retrieveTopK(
  query: string,
  corpus: CorpusEntry[],
  topK = 3
): Promise<CorpusEntry[]> {
  const [queryVector, corpusEmbeddings] = await Promise.all([
    embedQuery(query),
    getCorpusEmbeddings(corpus),
  ]);

  const scored = corpusEmbeddings.map(({ id, vector }) => ({
    id,
    similarity: cosineSimilarity(queryVector, vector),
  }));

  scored.sort((a, b) => b.similarity - a.similarity);
  const topIds = new Set(scored.slice(0, topK).map((s) => s.id));
  return corpus.filter((e) => topIds.has(e.id));
}

export function clearEmbeddingCache(): void {
  _queryCache.clear();
  localStorage.removeItem(CORPUS_CACHE_KEY);
}
