import { useState } from "react";
import { runAI } from "@/services/aiService";
import { supabase } from "@/lib/supabaseClient";

export default function FarmScan() {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");

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

      setResult(res?.response || "No response");

      // OPTIONAL: later we connect tasks + alerts here
    } catch (err) {
      console.error(err);
      setResult("Error analyzing image");
    }

    setLoading(false);
  }

  return (
    <div className="p-4 space-y-4">

      <h2 className="text-lg font-bold">Scan Plant / Animal</h2>

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
          className="w-full rounded-lg"
        />
      )}

      <textarea
        placeholder="Describe symptoms..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full p-2 border rounded"
      />

      <button
        onClick={handleScan}
        disabled={loading}
        className="w-full bg-green-600 text-white p-3 rounded"
      >
        {loading ? "Analyzing..." : "Analyze Farm Issue"}
      </button>

      {result && (
        <div className="p-3 bg-gray-100 rounded">
          {result}
        </div>
      )}
    </div>
  );
}
