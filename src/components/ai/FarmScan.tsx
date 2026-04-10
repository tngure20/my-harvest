import { useState } from "react";
import { runAI } from "@/services/aiService";
import { supabase } from "@/lib/supabaseClient";

export default function FarmScan() {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function uploadImage(file: File) {
    const fileName = `${Date.now()}-${file.name}`;

    const { data, error } = await supabase.storage
      .from("post-media")
      .upload(fileName, file);

    if (error) throw error;

    const { data: publicUrl } = supabase.storage
      .from("post-media")
      .getPublicUrl(fileName);

    return publicUrl.publicUrl;
  }

  async function handleScan() {
    if (!image) return;

    setLoading(true);

    try {
      const imageUrl = await uploadImage(image);

      const res = await runAI({
        mode: "image",
        imageUrl,
        prompt: text,
      });

      let parsed;

      try {
        parsed = typeof res?.response === "string"
          ? JSON.parse(res.response)
          : res;
      } catch {
        parsed = {
          diagnosis: res?.response || "No result",
          confidence: 0.5,
          riskLevel: "medium",
          actions: [],
          alerts: [],
        };
      }

      setResult(parsed);

      // 🔥 FUTURE INTEGRATION HOOK (IMPORTANT)
      // Here we will connect:
      // - tasks system
      // - alerts system
      // - farm history logs

    } catch (err) {
      console.error(err);
      setResult({
        diagnosis: "Error analyzing image",
        confidence: 0,
        riskLevel: "low",
        actions: [],
        alerts: [],
      });
    }

    setLoading(false);
  }

  return (
    <div className="p-4 space-y-4">

      <h2 className="text-lg font-bold">Farm Scan</h2>

      {/* IMAGE UPLOAD */}
      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;

          setImage(file);
          setPreview(URL.createObjectURL(file));
        }}
      />

      {preview && (
        <img
          src={preview}
          className="w-full rounded-lg object-cover"
        />
      )}

      {/* OPTIONAL CONTEXT */}
      <textarea
        placeholder="Describe symptoms (optional)..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full p-2 border rounded"
      />

      {/* ACTION BUTTON */}
      <button
        onClick={handleScan}
        disabled={loading}
        className="w-full bg-green-600 text-white p-3 rounded"
      >
        {loading ? "Analyzing..." : "Scan & Diagnose"}
      </button>

      {/* RESULT DISPLAY */}
      {result && (
        <div className="p-3 bg-gray-100 rounded space-y-2">

          <p><strong>Diagnosis:</strong> {result.diagnosis}</p>

          <p><strong>Confidence:</strong> {result.confidence}</p>

          <p><strong>Risk:</strong> {result.riskLevel}</p>

          {result.actions?.length > 0 && (
            <div>
              <strong>Actions:</strong>
              <ul className="list-disc ml-5">
                {result.actions.map((a: string, i: number) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          {result.alerts?.length > 0 && (
            <div className="text-red-600">
              <strong>Alerts:</strong>
              <ul className="list-disc ml-5">
                {result.alerts.map((a: string, i: number) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
