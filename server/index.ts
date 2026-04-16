
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const HF_API_KEY = process.env.HF_API_KEY;

// Models
const TEXT_MODEL =
  "mistralai/Mistral-7B-Instruct-v0.3";

const IMAGE_MODEL =
  "linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification";

// Shared HF caller
async function callHF(url: string, body: any) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HF_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`HF error: ${res.status}`);
  }

  return res.json();
}
app.post("/api/ai/text", async (req, res) => {
  try {
    const { prompt } = req.body;

    const data = await callHF(
      `https://api-inference.huggingface.co/models/${TEXT_MODEL}`,
      {
        inputs: prompt,
        parameters: {
          max_new_tokens: 400,
          temperature: 0.7,
        },
      }
    );

    res.json({
      success: true,
      data,
      model: TEXT_MODEL,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "text_ai_failed",
    });
  }
});
app.post("/api/ai/image", async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    const data = await callHF(
      `https://api-inference.huggingface.co/models/${IMAGE_MODEL}`,
      {
        inputs: imageBase64,
      }
    );

    res.json({
      success: true,
      predictions: data,
      model: IMAGE_MODEL,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "image_ai_failed",
    });
  }
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`AI Gateway running on port ${PORT}`);
});
