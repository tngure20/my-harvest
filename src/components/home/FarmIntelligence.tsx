/**
 * FarmIntelligence — unified decision card on the Home page.
 * Single network call to the Edge Function `ai-gateway/farm-intel`.
 * The frontend does NOT orchestrate weather + news + AI for this card —
 * everything is fused server-side.
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Brain, RefreshCw, AlertTriangle, CloudRain, Bug, Sprout,
  TrendingUp, CheckCircle2, Loader2, ChevronDown, ChevronUp, Info,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchFarmIntelligence,
  type FarmIntelResult,
  type FarmIntelAlert,
} from "@/services/farmIntelService";

const RISK_STYLES: Record<string, { ring: string; pill: string; label: string }> = {
  low:    { ring: "ring-emerald-500/20",  pill: "bg-emerald-100 text-emerald-700",  label: "Low risk"    },
  medium: { ring: "ring-amber-500/30",    pill: "bg-amber-100 text-amber-700",      label: "Medium risk" },
  high:   { ring: "ring-rose-500/30",     pill: "bg-rose-100 text-rose-700",        label: "High risk"   },
};

const ALERT_ICON: Record<string, typeof AlertTriangle> = {
  weather: CloudRain,
  pest:    Bug,
  disease: Sprout,
  market:  TrendingUp,
  general: Info,
};

const SEVERITY_COLOR: Record<string, string> = {
  low:    "text-emerald-600 bg-emerald-50",
  medium: "text-amber-600  bg-amber-50",
  high:   "text-rose-600   bg-rose-50",
};

const FarmIntelligence = () => {
  const { isAuthenticated } = useAuth();
  const [result, setResult]   = useState<FarmIntelResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);

  const load = async (force = false) => {
    setError(null);
    if (force) setRefreshing(true); else setLoading(true);
    try {
      const data = await fetchFarmIntelligence({ force });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load farm intelligence");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  // ─── Loading skeleton ────────────────────────────────────────────────
  if (loading) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="harvest-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Brain className="h-4 w-4 text-primary" />
          </div>
          <h2 className="harvest-section-title">Farm Intelligence</h2>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analysing weather, news, and your farm…
        </div>
      </motion.div>
    );
  }

  // ─── Error state ─────────────────────────────────────────────────────
  if (error || !result) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="harvest-card p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <Brain className="h-4 w-4 text-primary" />
            </div>
            <h2 className="harvest-section-title">Farm Intelligence</h2>
          </div>
          <button
            onClick={() => load(true)}
            className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
        <p className="text-sm text-muted-foreground">{error ?? "No intelligence available yet."}</p>
      </motion.div>
    );
  }

  const intel       = result.intelligence;
  const riskStyle   = RISK_STYLES[intel.risk_level] ?? RISK_STYLES.medium;
  const isFallback  = result.aiSource === "fallback";
  const meta        = result.contextMeta;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className={`harvest-card overflow-hidden ring-1 ${riskStyle.ring}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Brain className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="harvest-section-title">Farm Intelligence</h2>
            {meta && (
              <p className="text-[11px] text-muted-foreground">
                {meta.location || "Your farm"}
                {meta.activityCount > 0 && ` · ${meta.activityCount} active`}
                {result.fromCache && " · cached"}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${riskStyle.pill}`}>
            {riskStyle.label}
          </span>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground disabled:opacity-50"
            aria-label="Refresh intelligence"
            title="Refresh intelligence"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Headline */}
      <div className="px-5 pt-3">
        <p className="text-sm font-semibold text-foreground leading-snug">
          {intel.headline}
        </p>
      </div>

      {/* Alerts */}
      {intel.alerts.length > 0 && (
        <div className="px-5 mt-3 space-y-2">
          {intel.alerts.slice(0, 4).map((a, i) => (
            <AlertRow key={i} alert={a} />
          ))}
        </div>
      )}

      {/* Recommendations */}
      {intel.recommendations.length > 0 && (
        <div className="px-5 mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Recommended actions
          </p>
          <ul className="space-y-1.5">
            {intel.recommendations.slice(0, 5).map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" />
                <span className="leading-snug">{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Farm-action targets */}
      {intel.farm_actions.length > 0 && (
        <div className="px-5 mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Updates for your farm activities
          </p>
          <div className="space-y-1.5">
            {intel.farm_actions.slice(0, 4).map((fa, i) => (
              <div key={i} className="rounded-lg border border-border bg-muted/30 p-2.5">
                <p className="text-xs font-semibold text-foreground">{fa.activity}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {fa.action}
                  {typeof fa.due_within_days === "number" && (
                    <span className="ml-1 text-primary font-medium">
                      · within {fa.due_within_days} day{fa.due_within_days === 1 ? "" : "s"}
                    </span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reasoning */}
      <div className="px-5 mt-4 pb-4">
        <button
          onClick={() => setShowReasoning((v) => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
        >
          {showReasoning ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          Why this advice?
        </button>
        {showReasoning && (
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            {intel.reasoning}
            {meta && (
              <span className="block mt-2 text-[10px] uppercase tracking-wider">
                Sources used:
                {meta.hasWeather && " · weather"}
                {meta.hasNews    && " · news"}
                {meta.activityCount > 0 && " · farm data"}
                {isFallback     && " · (AI offline — heuristic)"}
              </span>
            )}
          </p>
        )}
      </div>
    </motion.div>
  );
};

const AlertRow = ({ alert }: { alert: FarmIntelAlert }) => {
  const Icon  = ALERT_ICON[alert.type] ?? ALERT_ICON.general;
  const sev   = SEVERITY_COLOR[alert.severity] ?? SEVERITY_COLOR.medium;
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border p-2.5">
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${sev}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground leading-tight">{alert.title}</p>
        <p className="text-xs text-muted-foreground leading-snug mt-0.5">{alert.message}</p>
      </div>
    </div>
  );
};

export default FarmIntelligence;
