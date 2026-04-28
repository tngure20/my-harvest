import { useRef, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { motion } from "framer-motion";
import {
  Camera, Upload, Loader2, ChevronLeft, AlertTriangle,
  CheckCircle2, RefreshCw, ExternalLink, Sparkles, Leaf, Bug,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { analyzeImage, type AIResponse } from "@/services/aiService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const SUBJECT_OPTIONS = [
  { id: "crop", label: "Crop / plant", icon: Leaf },
  { id: "livestock", label: "Livestock", icon: Bug },
] as const;

type Subject = typeof SUBJECT_OPTIONS[number]["id"];

const confidenceColor = (c?: AIResponse["confidence"]) => {
  if (c === "high") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
  if (c === "medium") return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  return "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300";
};

const ImageDiagnosis = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [subject, setSubject] = useState<Subject>("crop");
  const [name, setName] = useState("");          // optional crop/animal name
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  };

  const onPickFile = (f: File | null | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      toast.error("Image is too large (max 8 MB)");
      return;
    }
    setFile(f);
    setResult(null);
    setError(null);
    const url = URL.createObjectURL(f);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const res = await analyzeImage(file, {
        cropType: subject === "crop" ? (name || undefined) : undefined,
        livestockType: subject === "livestock" ? (name || undefined) : undefined,
        location: user?.location,
        region: user?.region,
        country: user?.country,
      });
      setResult(res);
    } catch (e) {
      console.warn("[ImageDiagnosis] analyze failed", e);
      setError("Couldn't analyze the image right now. Please check your connection and try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <AppLayout>
      <div className="px-4 py-4 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
            aria-label="Go back"
            data-testid="button-back"
          >
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground">Image Diagnosis</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Photograph an affected leaf, stem, or animal — we'll suggest what it might be.
            </p>
          </div>
        </div>

        {/* Subject selector */}
        <div className="harvest-card p-4 space-y-3">
          <p className="text-xs font-semibold text-foreground">What are you scanning?</p>
          <div className="grid grid-cols-2 gap-2">
            {SUBJECT_OPTIONS.map(({ id, label, icon: Icon }) => {
              const active = subject === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSubject(id)}
                  data-testid={`subject-${id}`}
                  className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-xs font-medium transition-colors ${
                    active
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-card text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={subject === "crop" ? "e.g. Maize, Tomato (optional)" : "e.g. Cattle, Goat (optional)"}
            className="w-full rounded-xl border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            data-testid="input-subject-name"
          />
        </div>

        {/* Picker / preview */}
        {!previewUrl ? (
          <div className="harvest-card p-5 space-y-3">
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0])}
              data-testid="input-camera"
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0])}
              data-testid="input-file"
            />

            <div className="flex flex-col items-center gap-3 py-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Camera className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Take or upload a photo</p>
                <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                  For best results, use natural daylight and focus on the affected area.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
                data-testid="button-take-photo"
              >
                <Camera className="h-4 w-4" /> Take photo
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-full border bg-card px-4 py-2.5 text-sm font-medium text-foreground"
                data-testid="button-upload"
              >
                <Upload className="h-4 w-4" /> Upload
              </button>
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="harvest-card overflow-hidden"
          >
            <img
              src={previewUrl}
              alt="Selected for diagnosis"
              className="w-full max-h-80 object-contain bg-muted"
              data-testid="image-preview"
            />
            <div className="p-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={analyzing}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                data-testid="button-analyze"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Analyzing…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Analyze image
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={reset}
                disabled={analyzing}
                className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-2.5 text-sm font-medium text-foreground disabled:opacity-50"
                data-testid="button-reset"
              >
                <RefreshCw className="h-4 w-4" /> Change
              </button>
            </div>
          </motion.div>
        )}

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            data-testid="error-banner"
          >
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>{error}</p>
          </motion.div>
        )}

        {/* Results */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
            data-testid="diagnosis-result"
          >
            <div className="harvest-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ${confidenceColor(result.confidence)}`}>
                  {result.confidence ?? "low"} confidence
                </span>
                {result.source && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground capitalize">
                    {result.source}
                  </span>
                )}
              </div>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{result.message}</p>
            </div>

            {result.predictions && result.predictions.length > 0 && (
              <div className="harvest-card p-4 space-y-2">
                <p className="text-xs font-semibold text-foreground">Top matches</p>
                {result.predictions.slice(0, 5).map((p, i) => (
                  <div key={`${p.label}-${i}`} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-foreground capitalize truncate">{p.label.replace(/_/g, " ")}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{Math.round(p.score * 100)}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${Math.max(2, Math.round(p.score * 100))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {result.nextSteps && result.nextSteps.length > 0 && (
              <div className="harvest-card p-4 space-y-2">
                <p className="text-xs font-semibold text-foreground">What to do next</p>
                <ul className="space-y-1.5">
                  {result.nextSteps.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      <span className="leading-relaxed">{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.resources && result.resources.length > 0 && (
              <div className="harvest-card p-4 space-y-2">
                <p className="text-xs font-semibold text-foreground">Trusted resources</p>
                {result.resources.map((r) => (
                  <a
                    key={r.url}
                    href={r.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2 text-sm text-foreground hover:bg-muted"
                  >
                    <span className="truncate">{r.title}</span>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </a>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={reset}
                className="flex flex-1 items-center justify-center gap-2 rounded-full border bg-card px-4 py-2.5 text-sm font-medium text-foreground"
                data-testid="button-new-scan"
              >
                <Camera className="h-4 w-4" /> Scan another
              </button>
              <button
                type="button"
                onClick={() => navigate("/assistant")}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
                data-testid="button-ask-assistant"
              >
                Ask AI Chat
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
};

export default ImageDiagnosis;
