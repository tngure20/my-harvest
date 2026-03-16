import { useState, useRef, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { Bot, Send, Lightbulb, Stethoscope, CalendarDays, ArrowLeft, BookOpen, ExternalLink, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { fetchFarmActivities } from "@/lib/supabaseService";
import { useQuery } from "@tanstack/react-query";
import { getGuidance, getActivityAdvice, type AssistantMode, type GuidanceResponse, type KnowledgeSource } from "@/lib/agricultureKnowledge";
import ReactMarkdown from "react-markdown";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  guidance?: GuidanceResponse;
  timestamp: Date;
}

const modes: { id: AssistantMode; label: string; icon: typeof Lightbulb; desc: string }[] = [
  { id: "advice", label: "Advice", icon: Lightbulb, desc: "General farming guidance" },
  { id: "diagnosis", label: "Diagnosis", icon: Stethoscope, desc: "Troubleshoot problems" },
  { id: "planning", label: "Planning", icon: CalendarDays, desc: "Plan farm activities" },
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

const SourceBadge = ({ source }: { source: KnowledgeSource }) => {
  const typeColors: Record<string, string> = {
    government: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    research: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
    fao: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    extension: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
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
      {guidance.sources.map((src, i) => (
        <SourceBadge key={i} source={src} />
      ))}
    </div>
    <p className="flex items-start gap-1.5 rounded-lg bg-muted/50 p-2 text-[11px] text-muted-foreground">
      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
      {guidance.disclaimer}
    </p>
  </div>
);

const FarmAssistant = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AssistantMode>("advice");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
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

  const handleSend = (text?: string) => {
    const query = (text || input).trim();
    if (!query) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: query,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Simulate processing delay
    setTimeout(() => {
      const guidance = getGuidance(query, mode);
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: guidance.summary,
        guidance,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsTyping(false);
    }, 800 + Math.random() * 700);
  };

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
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-foreground">Farm Assistant</h1>
                <p className="text-[11px] text-muted-foreground">Agricultural guidance powered by verified sources</p>
              </div>
            </div>
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
                <Bot className="mx-auto h-10 w-10 text-primary/40 mb-2" />
                <p className="text-sm text-muted-foreground">
                  {mode === "advice" && "Ask me anything about farming — crops, livestock, soil, and more."}
                  {mode === "diagnosis" && "Describe a problem with your crops or animals and I'll help diagnose it."}
                  {mode === "planning" && "Let me help you plan planting schedules, fertilizer applications, or harvest timing."}
                </p>
              </div>

              {farmActivities.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Your farm activities:</p>
                  <div className="flex flex-wrap gap-2">
                    {farmActivities.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => handleSend(`Advice for my ${a.species || a.type} (${a.name})`)}
                        className="rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                      >
                        {a.name}
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
                      className="rounded-full border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-muted"
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
                    className={`max-w-[90%] rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-card border rounded-bl-md"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <p className="text-sm">{msg.content}</p>
                    ) : msg.guidance ? (
                      <GuidanceCard guidance={msg.guidance} />
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    )}
                    <p className={`mt-1 text-[10px] ${msg.role === "user" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </motion.div>
              ))}
              <AnimatePresence>
                {isTyping && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-1 px-4 py-2">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        {/* Input */}
        <div className="border-t bg-card px-4 py-3">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={
                mode === "advice" ? "Ask a farming question..." :
                mode === "diagnosis" ? "Describe the problem..." :
                "What do you want to plan?"
              }
              className="flex-1 rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default FarmAssistant;
