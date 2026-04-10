import { useState, useRef, useEffect, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import {
  Bot, Send, Lightbulb, Stethoscope, CalendarDays, ArrowLeft,
  BookOpen, ExternalLink, AlertTriangle, Sparkles, BarChart2, Cpu,
  Camera, X, Upload,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { type AssistantMode, type GuidanceResponse, type KnowledgeSource } from "@/lib/agricultureKnowledge";
import { askAI, buildDailyTipsQuery, buildFarmAnalysisQuery } from "@/services/aiService";
import { logAIRequest, resolveAIRequest, failAIRequest, uploadFarmMedia } from "@/services/farmService";
import { fetchFarmRecords, type FarmRecord } from "@/services/farmService";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

type Confidence = "high" | "medium" | "low";
type Feedback = "helpful" | "not_helpful" | null;

interface NextStep {
  icon: string;
  text: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  guidance?: GuidanceResponse;
  source?: "knowledge-base" | "ai-model";
  confidence?: Confidence;
  nextSteps?: NextStep[];
  isDiagnosis?: boolean;
  feedback?: Feedback;
  timestamp: Date;
}

interface PendingImage {
  file: File;
  preview: string;
}

const modes: { id: AssistantMode; label: string; icon: typeof Lightbulb; desc: string; placeholder: string }[] = [
  { id: "advice",    label: "Q&A",     icon: Lightbulb,    desc: "Ask any farming question",        placeholder: "Ask a farming question…" },
  { id: "diagnosis", label: "Diagnose", icon: Stethoscope,  desc: "Troubleshoot problems",           placeholder: "Describe the problem with your crop or animal…" },
  { id: "planning",  label: "Plan",     icon: CalendarDays, desc: "Plan & schedule",                 placeholder: "What do you need help planning?" },
];

const quickQuestions: Record<AssistantMode, string[]> = {
  advice: ["How do I grow maize?", "Best practices for dairy farming", "How to start fish farming", "Soil health tips"],
  diagnosis: ["My crop leaves are turning yellow", "My tomato plants are wilting", "My cow is sick", "How to identify fall armyworm"],
  planning: ["When should I plant?", "Fertilizer application schedule", "How to plan irrigation", "Planting calendar for Kenya"],
};

// ─── Sub-components ───────────────────────────────────────

const SourceBadge = ({ source }: { source: KnowledgeSource }) => {
  const typeColors: Record<string, string> = {
    government: "bg-blue-50 text-blue-700",
    research:   "bg-purple-50 text-purple-700",
    fao:        "bg-emerald-50 text-emerald-700",
    extension:  "bg-amber-50 text-amber-700",
    university: "bg-indigo-50 text-indigo-700",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${typeColors[source.type] ?? "bg-muted text-muted-foreground"}`}>
      <BookOpen className="h-2.5 w-2.5" />{source.name}
      {source.url && <ExternalLink className="h-2 w-2" />}
    </span>
  );
};

const CONFIDENCE_STYLES: Record<Confidence, { label: string; color: string; bg: string }> = {
  high:   { label: "High confidence",   color: "text-emerald-700", bg: "bg-emerald-100" },
  medium: { label: "Medium confidence", color: "text-amber-700",   bg: "bg-amber-100" },
  low:    { label: "Low confidence",    color: "text-red-700",     bg: "bg-red-100" },
};

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const cfg = CONFIDENCE_STYLES[confidence];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.bg} ${cfg.color}`}>
      <BarChart2 className="h-2.5 w-2.5" /> {cfg.label}
    </span>
  );
}

function FeedbackButtons({ onFeedback, feedback }: { onFeedback: (fb: "helpful" | "not_helpful") => void; feedback: "helpful" | "not_helpful" | null | undefined }) {
  if (feedback) {
    return (
      <p className="text-[10px] text-muted-foreground italic">
        {feedback === "helpful" ? "Thanks for your feedback!" : "Feedback recorded. We'll improve."}
      </p>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground">Was this helpful?</span>
      <button onClick={() => onFeedback("helpful")} className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 hover:bg-emerald-200">Yes</button>
      <button onClick={() => onFeedback("not_helpful")} className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 hover:bg-red-200">No</button>
    </div>
  );
}

const GuidanceCard = ({ guidance }: { guidance: GuidanceResponse }) => (
  <div className="space-y-3">
    <h3 className="font-display text-base font-bold text-foreground">{guidance.title}</h3>
    <p className="text-sm text-muted-foreground leading-relaxed">{guidance.summary}</p>
    {guidance.sections.map((section, i) => (
      <div key={i} className="rounded-lg border bg-background p-3">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">{section.heading}</h4>
        <ul className="space-y-1.5">
          {section.points.map((point, j) => (
            <li key={j} className="flex gap-2 text-sm text-foreground/90">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>
    ))}
    <div className="flex flex-wrap gap-1.5">
      {guidance.sources.map((src, i) => <SourceBadge key={i} source={src} />)}
    </div>
    <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-200 p-2 text-[11px] text-amber-800">
      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
      <span><strong>Disclaimer:</strong> {guidance.disclaimer} Always verify with a local agricultural extension officer or veterinarian before taking action.</span>
    </p>
  </div>
);

// ─── Main Component ───────────────────────────────────────

const FarmAssistant = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AssistantMode>("advice");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [uploading, setUploading] = useState(false);
const [farmRecords, setFarmRecords] = useState<FarmRecord[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionIdRef = useRef(crypto.randomUUID());

  // Function to handle thumbs up/down feedback
  const handleFeedback = (msgId: string, fb: "helpful" | "not_helpful") => {
    setMessages((prev) =>
      prev.map((m) => m.id === msgId ? { ...m, feedback: fb } : m)
    );
  };
 
  useEffect(() => {
    if (isAuthenticated) {
      fetchFarmRecords().then(setFarmRecords).catch(() => {});
    }
  }, [isAuthenticated]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be smaller than 10 MB");
      return;
    }
    const preview = URL.createObjectURL(file);
    setPendingImage({ file, preview });
    e.target.value = "";
    // Auto-switch to diagnosis mode when image is attached
    setMode("diagnosis");
  };

  const removePendingImage = () => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.preview);
    setPendingImage(null);
  };

  const handleSend = useCallback(async (text?: string) => {
    const query = (text || input).trim();
    if (!query && !pendingImage) return;
    if (isTyping) return;

    const hasImage = !!pendingImage;
    const captured = pendingImage;
    const userContent = query || "Please analyse this image and identify any diseases, pests, or health issues. Give actionable treatment advice.";

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: userContent,
      imageUrl: captured?.preview,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setPendingImage(null);
    setIsTyping(true);

    // Upload image to Supabase storage
    let imageUrl: string | undefined;
    if (captured) {
      setUploading(true);
      try {
        imageUrl = await uploadFarmMedia(captured.file);
      } catch {
        // Continue without persisted URL — show local preview only
      } finally {
        setUploading(false);
      }
    }

    // Log request to DB (non-blocking)
    let reqId: string | undefined;
    if (user?.id) {
      try {
        reqId = await logAIRequest({
          sessionId: sessionIdRef.current,
          requestType: hasImage ? "image_diagnosis" : "chatbot",
          mode,
          textQuery: query || undefined,
          imageUrl,
        });
      } catch { /* non-blocking */ }
    }

    // Build AI query
    const aiQuery = imageUrl
      ? `[Farmer uploaded a crop/plant image for diagnosis]\n\n${userContent}\n\nImage URL: ${imageUrl}`
      : userContent;

    try {
      const response = await askAI({
        mode: hasImage ? "diagnosis" : mode,
        query: aiQuery,
        userId: user?.id,
        farmRecords,
      });

      const isDiagnosis = hasImage || mode === "diagnosis";
      const confidence: Confidence = response.source === "ai-model" ? "high" : isDiagnosis ? "medium" : "high";
      const nextSteps: NextStep[] = isDiagnosis ? [
        { icon: "🔍", text: "Monitor the affected area daily for changes" },
        { icon: "📸", text: "Take photos every 2 days to track progression" },
        { icon: "👨‍🌾", text: "Contact your local agricultural extension officer if condition worsens" },
        { icon: "💊", text: "Isolate affected plants/animals to prevent spread" },
      ] : [];
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.content,
        guidance: response.guidance,
        source: response.source,
        confidence,
        nextSteps,
        isDiagnosis,
        feedback: null,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);

      if (reqId) resolveAIRequest(reqId, response.content).catch(() => {});
    } catch {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Sorry, I had trouble answering that. Please try again.",
        timestamp: new Date(),
      }]);
      if (reqId) failAIRequest(reqId).catch(() => {});
    } finally {
      setIsTyping(false);
    }
  }, [input, isTyping, mode, user?.id, farmRecords, pendingImage]);

  const handleDailyTips = () => {
    setMode("planning");
    handleSend(buildDailyTipsQuery(farmRecords));
  };

  const handleFarmAnalysis = () => {
    setMode("planning");
    handleSend(buildFarmAnalysisQuery(farmRecords));
  };

  if (!isAuthenticated) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <Bot className="h-12 w-12 text-muted-foreground mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Farm Assistant</h1>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">Sign in to get personalised agricultural advice and AI disease diagnosis.</p>
          <button onClick={() => navigate("/login")} className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground">Sign In</button>
        </div>
      </AppLayout>
    );
  }

  const currentMode = modes.find(m => m.id === mode)!;

  return (
    <AppLayout>
      <div className="flex flex-col" style={{ height: "calc(100vh - 8rem)" }}>

        {/* Header */}
        <div className="px-4 py-3 border-b bg-card space-y-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-sm font-bold text-foreground">Farm Assistant</h1>
                  <span className="flex items-center gap-0.5 rounded-full bg-harvest-green-100 px-1.5 py-0.5 text-[9px] font-semibold text-harvest-green-600">
                    <Cpu className="h-2.5 w-2.5" /> AI
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate">Agricultural guidance · {currentMode.desc}</p>
              </div>
            </div>
          </div>
          {/* Mode tabs */}
          <div className="flex gap-1 rounded-xl bg-muted p-1">
            {modes.map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors ${mode === m.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                <m.icon className="h-3.5 w-3.5" />{m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                  <Bot className="h-7 w-7 text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">Hello{user?.name ? `, ${user.name.split(" ")[0]}` : ""}!</p>
                <p className="mt-1 text-xs text-muted-foreground max-w-xs mx-auto">
                  {mode === "advice" && "Ask me anything about crops, livestock, soil, or any farming challenge."}
                  {mode === "diagnosis" && "Describe a problem or upload a photo of your crop/animal for AI diagnosis."}
                  {mode === "planning" && "Let me help you plan planting schedules, fertilizer applications, or your next steps."}
                </p>
              </div>

              {/* Image diagnosis CTA */}
              {mode === "diagnosis" && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-4 text-left hover:bg-primary/10 transition-colors"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Camera className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Upload plant or animal photo</p>
                    <p className="text-xs text-muted-foreground">AI will identify diseases, pests, and recommend treatment</p>
                  </div>
                  <Upload className="ml-auto h-4 w-4 text-primary" />
                </button>
              )}

              {/* Quick actions */}
              <div className="flex gap-2">
                <button onClick={handleDailyTips} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border bg-card px-3 py-2.5 text-xs font-medium text-foreground hover:bg-muted">
                  <Sparkles className="h-3.5 w-3.5 text-harvest-gold-500" />Today's Tips
                </button>
                <button onClick={handleFarmAnalysis} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border bg-card px-3 py-2.5 text-xs font-medium text-foreground hover:bg-muted">
                  <BarChart2 className="h-3.5 w-3.5 text-primary" />Analyse My Farm
                </button>
              </div>

              {/* Farm activity context chips */}
              {farmRecords.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">From your farm:</p>
                  <div className="flex flex-wrap gap-2">
                    {farmRecords.map(a => (
                      <button key={a.id} onClick={() => handleSend(`Give me advice for my ${a.cropType || a.recordType} (${a.name})`)}
                        className="rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
                        {a.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick questions */}
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Try asking:</p>
                <div className="flex flex-wrap gap-2">
                  {quickQuestions[mode].map(q => (
                    <button key={q} onClick={() => handleSend(q)} className="rounded-full border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-muted">{q}</button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map(msg => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-card border rounded-bl-md"
                  }`}>
                    {msg.imageUrl && (
                      <img src={msg.imageUrl} alt="Uploaded" className="mb-2 h-36 w-full rounded-xl object-cover" />
                    )}
                    {msg.role === "user" ? (
                      <p className="text-sm">{msg.content}</p>
                    ) : msg.guidance ? (
                      <GuidanceCard guidance={msg.guidance} />
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none text-foreground [&>h2]:text-sm [&>h2]:font-bold [&>h3]:text-xs [&>h3]:font-semibold [&>p]:text-sm [&>ul]:text-sm [&>blockquote]:text-xs [&>blockquote]:text-muted-foreground [&>hr]:my-2">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    )}

                    {/* Confidence badge for assistant diagnosis messages */}
                    {msg.role === "assistant" && msg.confidence && (
                      <div className="mt-2">
                        <ConfidenceBadge confidence={msg.confidence} />
                        {msg.confidence === "low" && (
                          <p className="mt-1 text-[11px] text-amber-700">
                            Low confidence — please consult an expert before acting on this advice.
                          </p>
                        )}
                      </div>
                    )}

                    {/* What to do next — diagnosis only */}
                    {msg.role === "assistant" && msg.isDiagnosis && msg.nextSteps && msg.nextSteps.length > 0 && (
                      <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-blue-800">What to do next</p>
                        <ul className="space-y-1">
                          {msg.nextSteps.map((step, i) => (
                            <li key={i} className="flex gap-2 text-xs text-blue-900">
                              <span>{step.icon}</span>
                              <span>{step.text}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Disclaimer for diagnosis */}
                    {msg.role === "assistant" && msg.isDiagnosis && (
                      <div className="mt-2 flex items-start gap-1 rounded-lg bg-amber-50 border border-amber-200 p-2 text-[10px] text-amber-800">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>AI results are indicative only. Always verify with a qualified agronomist or veterinarian.</span>
                      </div>
                    )}

                    {/* Footer: timestamp + source + feedback */}
                    <div className={`mt-2 flex flex-wrap items-center gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <p className={`text-[10px] ${msg.role === "user" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                        {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      {msg.source === "ai-model" && (
                        <span className="flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                          <Cpu className="h-2 w-2" /> AI
                        </span>
                      )}
                      {msg.role === "assistant" && (
                        <FeedbackButtons
                          feedback={msg.feedback}
                          onFeedback={(fb) => handleFeedback(msg.id, fb)}
                        />
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}

              <AnimatePresence>
                {isTyping && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex gap-1 rounded-2xl rounded-bl-md bg-card border px-4 py-3">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        {/* Input area */}
        <div className="border-t bg-card px-4 py-3">
          {/* Pending image preview */}
          <AnimatePresence>
            {pendingImage && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="mb-2 flex items-center gap-3 rounded-xl border bg-muted/50 p-2">
                <img src={pendingImage.preview} alt="Preview" className="h-12 w-12 rounded-lg object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{pendingImage.file.name}</p>
                  <p className="text-[11px] text-primary">📷 Image ready · {mode === "diagnosis" ? "AI will diagnose" : "Will send with message"}</p>
                </div>
                <button onClick={removePendingImage} className="rounded-full bg-muted p-1">
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick suggestion chips */}
          {messages.length > 0 && (
            <div className="mb-2 flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
              <button onClick={handleDailyTips} className="shrink-0 flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted">
                <Sparkles className="h-3 w-3" /> Tips
              </button>
              <button onClick={handleFarmAnalysis} className="shrink-0 flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted">
                <BarChart2 className="h-3 w-3" /> Analyse
              </button>
              {quickQuestions[mode].slice(0, 2).map(q => (
                <button key={q} onClick={() => handleSend(q)} className="shrink-0 rounded-full border bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted">{q}</button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            {/* Camera / image upload button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Upload photo for AI diagnosis"
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                pendingImage ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              <Camera className="h-4 w-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleImageSelect}
            />

            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder={pendingImage ? "Describe what you see (optional)…" : currentMode.placeholder}
              className="flex-1 rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={() => handleSend()}
              disabled={(!input.trim() && !pendingImage) || isTyping || uploading}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40 transition-opacity"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>

          {uploading && (
            <p className="mt-1 text-[11px] text-center text-muted-foreground animate-pulse">Uploading image…</p>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default FarmAssistant;
