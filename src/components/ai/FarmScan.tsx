import { useState } from "react";
import { runAI } from "@/services/aiService";
import type { NormalizedAIResponse } from "@/services/aiService";
import { supabase } from "@/services/supabaseClient";
import { createFarmTask } from "@/services/farmService";

export default function FarmScan() {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NormalizedAIResponse | null>(null);

  async function upload(file: File) {
    const name = `${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("post-media").upload(name, file);
    if (error) throw error;
    const { data } = supabase.storage.from("post-media").getPublicUrl(name);
    return data.publicUrl;
  }

  async function handleScan() {
    if (!image) return;
    setLoading(true);

    try {
      const url = await upload(image);
      const res = await runAI({ mode: "image", imageUrl: url });
      setResult(res);

      // Create tasks from normalized actions (non-blocking)
      if (res.actions.length > 0) {
        for (const action of res.actions) {
          try {
            await createFarmTask({
              title: action.title,
              priority: action.priority,
              taskType: "ai_generated",
            });
          } catch { /* fail silently */ }
        }
      }
    } catch {
      setResult({
        summary: "Failed to analyze image. Please try again.",
        content: "Failed to analyze image. Please try again.",
        actions: [],
        alerts: [],
        followUpQuestions: [],
        source: "knowledge-base",
      });
    }

    setLoading(false);
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="font-bold text-lg">Scan Farm Issue</h2>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setImage(f);
          setPreview(URL.createObjectURL(f));
        }}
      />

      {preview && <img src={preview} className="rounded-lg w-full" alt="Preview" />}

      <button
        onClick={handleScan}
        disabled={loading}
        className="w-full bg-green-600 text-white p-3 rounded"
      >
        {loading ? "Analyzing..." : "Scan"}
      </button>

      {result && (
        <div className="space-y-3">
          <div className="bg-muted p-3 rounded text-sm whitespace-pre-line">
            {result.summary}
          </div>

          {result.diagnosis && (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded text-sm">
              <p className="font-semibold">Diagnosis: {result.diagnosis.issue}</p>
              <p className="text-xs text-muted-foreground">
                Confidence: {Math.round(result.diagnosis.confidence * 100)}% · Severity: {result.diagnosis.severity}
              </p>
            </div>
          )}

          {result.actions.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-1">Recommended Actions:</p>
              <ul className="space-y-1">
                {result.actions.map((a, i) => (
                  <li key={i} className="text-sm flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${a.priority === "high" ? "bg-red-500" : a.priority === "medium" ? "bg-amber-500" : "bg-green-500"}`} />
                    {a.title}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.alerts.length > 0 && (
            <div className="space-y-1">
              {result.alerts.map((a, i) => (
                <div key={i} className="bg-red-50 text-red-700 p-2 rounded text-sm">
                  {a.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
