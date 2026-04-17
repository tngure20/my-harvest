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
  const res = await hfFetch(`${HF_BASE}/v1/chat/completions`, {
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
    return { error: `hf_error_${res.status}`, detail: text.slice(0, 200) };
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
