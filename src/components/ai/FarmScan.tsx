import { useState } from "react";
import { runAI } from "@/services/aiService";
import { supabase } from "@/lib/supabaseClient";

export default function FarmScan() {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function upload(file: File) {
    const name = `${Date.now()}-${file.name}`;

    const { error } = await supabase.storage
      .from("post-media")
      .upload(name, file);

    if (error) throw error;

    const { data } = supabase.storage
      .from("post-media")
      .getPublicUrl(name);

    return data.publicUrl;
  }

  async function handleScan() {
    if (!image) return;

    setLoading(true);

    try {
      const url = await upload(image);

      const res = await runAI({
        mode: "image",
        imageUrl: url,
      });

      setResult(res);
    } catch {
      setResult({ diagnosis: "Failed to analyze image" });
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

      {preview && (
        <img src={preview} className="rounded-lg w-full" />
      )}

      <button
        onClick={handleScan}
        disabled={loading}
        className="w-full bg-green-600 text-white p-3 rounded"
      >
        {loading ? "Analyzing..." : "Scan"}
      </button>

      {result && (
        <div className="bg-gray-100 p-3 rounded text-sm">
          {JSON.stringify(result, null, 2)}
        </div>
      )}
    </div>
  );
}
