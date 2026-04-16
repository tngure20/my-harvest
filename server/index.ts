import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const HF_API_KEY = process.env.HF_API_KEY;

const TEXT_MODEL = "mistralai/Mistral-7B-Instruct-v0.3";
const IMAGE_MODEL = "linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification";
const IMAGE_FALLBACK = "google/vit-base-patch16-224";
const EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const HF_BASE = "https://api-inference.huggingface.co";
const TIMEOUT_MS = 30_000;

async function hfFetch(url: string, body: any, contentType = "application/json"): Promise<any> {
  if (!HF_API_KEY) throw new Error("HF_API_KEY not configured");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        "Content-Type": contentType,
      },
      body: contentType === "application/json" ? JSON.stringify(body) : body,
      signal: controller.signal as any,
    });

    if (res.status === 503) {
      const data = (await res.json().catch(() => ({}))) as { estimated_time?: number };
      return { error: "model_loading", estimated_time: data.estimated_time || 20 };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { error: `hf_error_${res.status}`, detail: text.slice(0, 200) };
    }

    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// POST /api/ai/text — Chat completions via Mistral-7B
app.post("/api/ai/text", async (req, res) => {
  try {
    const { prompt, maxTokens = 600, temperature = 0.35 } = req.body;
    if (!prompt) return res.status(400).json({ error: "prompt_required" });

    const data = await hfFetch(`${HF_BASE}/v1/chat/completions`, {
      model: TEXT_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      temperature,
      stream: false,
    });

    if (data?.error) return res.status(502).json(data);

    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) return res.status(502).json({ error: "empty_response" });

    res.json({ success: true, content, model: TEXT_MODEL });
  } catch (err: any) {
    res.status(500).json({ error: "text_ai_failed", detail: err?.message });
  }
});

// POST /api/ai/image — Image classification with fallback
app.post("/api/ai/image", async (req, res) => {
  try {
    const { imageBase64, contentType = "image/jpeg" } = req.body;
    if (!imageBase64) return res.status(400).json({ error: "image_required" });

    const buffer = Buffer.from(imageBase64, "base64");

    for (const modelId of [IMAGE_MODEL, IMAGE_FALLBACK]) {
      try {
        const data = await hfFetch(`${HF_BASE}/models/${modelId}`, buffer, contentType);
        if (data?.error) continue;
        if (Array.isArray(data) && data[0]?.label) {
          return res.json({ success: true, predictions: data.slice(0, 5), model: modelId });
        }
      } catch {
        continue;
      }
    }

    res.status(502).json({ error: "image_classification_failed" });
  } catch (err: any) {
    res.status(500).json({ error: "image_ai_failed", detail: err?.message });
  }
});

// POST /api/ai/embed — Sentence embeddings
app.post("/api/ai/embed", async (req, res) => {
  try {
    const { inputs } = req.body;
    if (!inputs) return res.status(400).json({ error: "inputs_required" });

    const data = await hfFetch(`${HF_BASE}/models/${EMBED_MODEL}`, {
      inputs,
      options: { wait_for_model: true },
    });

    if (data?.error) return res.status(502).json(data);

    res.json({ success: true, embeddings: data });
  } catch (err: any) {
    res.status(500).json({ error: "embed_failed", detail: err?.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AI Gateway running on port ${PORT}`);
});
