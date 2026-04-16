import { useState, useRef, useEffect, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import {
  Bot, Send, Lightbulb, Stethoscope, CalendarDays, ArrowLeft,
  BookOpen, ExternalLink, AlertTriangle, Camera, X, Sparkles,
  ChevronRight, Loader2, RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { fetchFarmActivities } from "@/lib/supabaseService";
import { useQuery } from "@tanstack/react-query";
import type { GuidanceResponse, KnowledgeSource, AssistantMode } from "@/lib/agricultureKnowledge";
import type { AIResponse, FarmingContext, TrustedResource } from "@/services/aiService";
import { queryAI, analyzeImage, queryActivityAdvice } from "@/services/aiService";
import ReactMarkdown from "react-markdown";

// ─── Chat message types ────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** New: structured AI response (HF or fallback) */
  aiResponse?: AIResponse;
  timestamp: Date;
  /** True while the message is being loaded */
  pending?: boolean;
}

// ─── Mode config ──────────────────────────────────────────────────────────────

const modes: { id: AssistantMode; label: string; icon: typeof Lightbulb; desc: string }[] = [
  { id: "advice",    label: "Advice",    icon: Lightbulb,    desc: "General farming guidance" },
  { id: "diagnosis", label: "Diagnosis", icon: Stethoscope,  desc: "Troubleshoot problems" },
  { id: "planning",  label: "Planning",  icon: CalendarDays, desc: "Plan farm activities" },
];

const quickQuestions: Record<AssistantMode, string[]> = {
  advice: [
    "How do I grow maize?",
    "Best practices for dairy farming",
    "How to start fish farming",
    "Soil health management tips",
  ],
  diagnosis: [
    "My crop leaves are turning yellow",
    "My tomato plants are wilting",
    "My cow is sick and not eating",
    "How to identify fall armyworm",
  ],
  planning: [
    "When should I plant this season?",
    "Fertilizer application schedule",
    "How to plan irrigation",
    "Planting calendar for Kenya",
  ],
};

// ─── UI sub-components ────────────────────────────────────────────────────────

const SourceBadge = ({ source }: { source: KnowledgeSource }) => {
  const typeColors: Record<string, string> = {
    government: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    research:   "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
    fao:        "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    extension:  "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    university: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${typeColors[source.type] || "bg-muted text-muted-foreground"}`}>
      <BookOpen className="h-2.5 w-2.5" />
      {source.name}
      {source.url && <ExternalLink className="h-2 w-2" />}
    </span>
  );
};

const GuidanceCard = ({ guidance }: { guidance: GuidanceResponse }) => (
  <div className="space-y-3">
    <h3 className="font-display text-base font-bold text-foreground">{guidance.title}</h3>
    <p className="text-sm text-muted-foreground leading-relaxed">{guidance.summary}</p>
    {guidance.sections.map((section, i) => (
      <div key={i} className="rounded-lg border bg-background p-3">
        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">{section.heading}</h4>
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
    <p className="flex items-start gap-1.5 rounded-lg bg-muted/50 p-2 text-[11px] text-muted-foreground">
      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
      {guidance.disclaimer}
    </p>
  </div>
);

/** Confidence badge shown on AI responses */
const ConfidenceBadge = ({ level, source }: { level: AIResponse["confidence"]; source: AIResponse["source"] }) => {
  const colors = {
    high:   "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    medium: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    low:    "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${colors[level]}`}>
      {source === "huggingface" ? <Sparkles className="h-2.5 w-2.5" /> : <BookOpen className="h-2.5 w-2.5" />}
      {level} confidence · {source === "huggingface" ? "AI" : "Knowledge base"}
    </span>
  );
};

/** Render a single trusted resource link */
const ResourceLink = ({ resource }: { resource: TrustedResource }) => (
  <a
    href={resource.url}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-muted transition-colors"
  >
    <ExternalLink className="h-2.5 w-2.5" />
    {resource.name}
  </a>
);

/** Card for rendering a structured AIResponse (HF or fallback) */
const AIResponseCard = ({ aiResponse }: { aiResponse: AIResponse }) => {
  // Fallback with full guidance object — render the rich GuidanceCard
  if (aiResponse.guidance) {
    return (
      <div className="space-y-2">
        <ConfidenceBadge level={aiResponse.confidence} source={aiResponse.source} />
        <GuidanceCard guidance={aiResponse.guidance} />
        {aiResponse.resources && aiResponse.resources.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {aiResponse.resources.map((r, i) => <ResourceLink key={i} resource={r} />)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ConfidenceBadge level={aiResponse.confidence} source={aiResponse.source} />

      {/* Weather context badge */}
      {aiResponse.weatherSummary && (
        <p className="text-[10px] text-muted-foreground bg-muted/40 rounded-lg px-2 py-1 leading-relaxed">
          📍 {aiResponse.weatherSummary.split(".").slice(0, 2).join(".")}
        </p>
      )}

      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown>{aiResponse.message}</ReactMarkdown>
      </div>

      {/* Image predictions */}
      {aiResponse.predictions && aiResponse.predictions.length > 0 && (
        <div className="rounded-lg border bg-background p-3 space-y-2">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">Top predictions</h4>
          {aiResponse.predictions.slice(0, 3).map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex-1 text-xs text-foreground truncate">{p.label}</div>
              <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.round(p.score * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground w-8 text-right">{Math.round(p.score * 100)}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Next steps */}
      {aiResponse.nextSteps.length > 0 && (
        <div className="rounded-lg border bg-background p-3">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Next steps</h4>
          <ol className="space-y-1.5">
            {aiResponse.nextSteps.map((step, i) => (
              <li key={i} className="flex gap-2 text-sm text-foreground/90">
                <span className="shrink-0 flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary mt-0.5">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Trusted resources */}
      {aiResponse.resources && aiResponse.resources.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {aiResponse.resources.map((r, i) => <ResourceLink key={i} resource={r} />)}
        </div>
      )}

      <p className="flex items-start gap-1.5 rounded-lg bg-muted/50 p-2 text-[11px] text-muted-foreground">
        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
        Always consult local extension officers for site-specific recommendations.
      </p>
    </div>
  );
};

// ─── Image upload preview ─────────────────────────────────────────────────────

const ImageUploadBar = ({
  onImageSelected,
  disabled,
}: {
  onImageSelected: (file: File, preview: string) => void;
  disabled: boolean;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        title="Upload a farm image for AI diagnosis"
        className="flex h-10 w-10 items-center justify-center rounded-xl border bg-card text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors"
        data-testid="button-upload-image"
      >
        <Camera className="h-4 w-4" />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const preview = URL.createObjectURL(file);
          onImageSelected(file, preview);
          e.target.value = "";
        }}
      />
    </>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const FarmAssistant = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AssistantMode>("advice");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ file: File; preview: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: farmActivities = [] } = useQuery({
    queryKey: ["/api/farm-activities", user?.id],
    queryFn: () => fetchFarmActivities(user!.id),
    enabled: !!user?.id && isAuthenticated,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  const buildContext = useCallback((): FarmingContext => ({
    location: user?.location || "Kenya",
    farmActivities: farmActivities.map((a) => `${a.name} (${a.type})`),
    mode,
  }), [user, farmActivities, mode]);

  const appendMessage = (msg: ChatMessage) =>
    setMessages((prev) => [...prev, msg]);

  const replaceMessage = (id: string, updates: Partial<ChatMessage>) =>
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, ...updates } : m));

  /** Send a text query or analyze a pending image */
  const handleSend = useCallback(async (text?: string) => {
    const query = (text || input).trim();
    const hasImage = !!pendingImage;

    if (!query && !hasImage) return;
    if (isTyping) return;

    // User message
    const userMsgId = crypto.randomUUID();
    appendMessage({
      id: userMsgId,
      role: "user",
      content: query || "📷 Sent an image for analysis",
      timestamp: new Date(),
    });
    setInput("");
    const capturedImage = pendingImage;
    setPendingImage(null);
    setIsTyping(true);

    // Pending assistant placeholder
    const assistantId = crypto.randomUUID();
    appendMessage({ id: assistantId, role: "assistant", content: "", pending: true, timestamp: new Date() });

    try {
      let aiResponse: AIResponse;
      const context = buildContext();

      if (hasImage && capturedImage) {
        aiResponse = await analyzeImage(capturedImage.file, { ...context, mode: "diagnosis" });
      } else {
        aiResponse = await queryAI(query, context, mode);
      }

      replaceMessage(assistantId, {
        content: aiResponse.message,
        aiResponse,
        pending: false,
      });
    } catch {
      replaceMessage(assistantId, {
        content: "Sorry, I couldn't process your request right now. Please try again.",
        pending: false,
      });
    } finally {
      setIsTyping(false);
    }
  }, [input, pendingImage, isTyping, mode, buildContext]);

  const handleActivityTap = useCallback(async (activityName: string, activityType: string) => {
    if (isTyping) return;

    const userMsgId = crypto.randomUUID();
    appendMessage({
      id: userMsgId,
      role: "user",
      content: `Advice for my ${activityType}: ${activityName}`,
      timestamp: new Date(),
    });
    setIsTyping(true);

    const assistantId = crypto.randomUUID();
    appendMessage({ id: assistantId, role: "assistant", content: "", pending: true, timestamp: new Date() });

    try {
      const aiResponse = await queryActivityAdvice(activityName, activityType, buildContext());
      replaceMessage(assistantId, { content: aiResponse.message, aiResponse, pending: false });
    } catch {
      replaceMessage(assistantId, { content: "Failed to get advice. Please try again.", pending: false });
    } finally {
      setIsTyping(false);
    }
  }, [isTyping, buildContext]);

  if (!isAuthenticated) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <Bot className="h-12 w-12 text-muted-foreground mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Farm Assistant</h1>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            Sign in to get personalized agricultural advice based on your farm data.
          </p>
          <button onClick={() => navigate("/login")} className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground">
            Sign In
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col" style={{ height: "calc(100vh - 8rem)" }}>
        {/* Header */}
        <div className="px-4 py-3 border-b bg-card">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => navigate(-1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-foreground">Farm Assistant</h1>
                <p className="text-[11px] text-muted-foreground">AI-powered agricultural guidance</p>
              </div>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                title="Clear chat"
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Mode tabs */}
          <div className="flex gap-1 rounded-xl bg-muted p-1">
            {modes.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                  mode === m.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
                data-testid={`tab-mode-${m.id}`}
              >
                <m.icon className="h-3.5 w-3.5" />
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="space-y-4">
              <div className="text-center py-6">
                <Sparkles className="mx-auto h-10 w-10 text-primary/40 mb-2" />
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  {mode === "advice"    && "Ask me anything about farming — crops, livestock, soil, and more."}
                  {mode === "diagnosis" && "Describe a problem or upload a photo of your crops for AI diagnosis."}
                  {mode === "planning"  && "Let me help you plan planting schedules, fertilizer applications, or harvest timing."}
                </p>
                {mode === "diagnosis" && (
                  <p className="mt-2 text-[11px] text-muted-foreground flex items-center justify-center gap-1">
                    <Camera className="h-3 w-3" /> Use the camera button below to upload a crop photo
                  </p>
                )}
              </div>

              {farmActivities.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Your farm activities:</p>
                  <div className="flex flex-wrap gap-2">
                    {farmActivities.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => handleActivityTap(a.name, a.type)}
                        className="flex items-center gap-1 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                        data-testid={`chip-activity-${a.id}`}
                      >
                        {a.name}
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Quick questions:</p>
                <div className="flex flex-wrap gap-2">
                  {quickQuestions[mode].map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      className="rounded-full border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[92%] rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-card border rounded-bl-md"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <p className="text-sm">{msg.content}</p>
                    ) : msg.pending ? (
                      <div className="flex gap-1 py-1">
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    ) : msg.aiResponse ? (
                      <AIResponseCard aiResponse={msg.aiResponse} />
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    )}
                    {!msg.pending && (
                      <p className={`mt-1 text-[10px] ${msg.role === "user" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                        {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </>
          )}
        </div>

        {/* Image preview */}
        <AnimatePresence>
          {pendingImage && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="mx-4 mb-2 flex items-center gap-2 rounded-xl border bg-card px-3 py-2"
            >
              <img src={pendingImage.preview} alt="Upload preview" className="h-12 w-12 rounded-lg object-cover" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{pendingImage.file.name}</p>
                <p className="text-[10px] text-muted-foreground">Ready for AI analysis</p>
              </div>
              <button
                onClick={() => { URL.revokeObjectURL(pendingImage.preview); setPendingImage(null); }}
                className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-muted transition-colors"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input bar */}
        <div className="border-t bg-card px-4 py-3">
          <div className="flex items-center gap-2">
            {/* Camera button — always visible, most useful in diagnosis mode */}
            <ImageUploadBar
              onImageSelected={(file, preview) => setPendingImage({ file, preview })}
              disabled={isTyping}
            />
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder={
                pendingImage ? "Add a note about the image... (optional)" :
                mode === "advice"    ? "Ask a farming question…" :
                mode === "diagnosis" ? "Describe the problem or upload a photo…" :
                "What do you want to plan?"
              }
              className="flex-1 rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
              data-testid="input-ai-message"
            />
            <button
              onClick={() => handleSend()}
              disabled={(!input.trim() && !pendingImage) || isTyping}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40 transition-opacity"
              data-testid="button-ai-send"
            >
              {isTyping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default FarmAssistant;
