import { Newspaper, ExternalLink, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState, useCallback } from "react";
import { getArticles } from "@/lib/dataService";
import {
  fetchAgriNewsWithMeta, clearNewsCache,
  type NewsArticle, type NewsResult,
} from "@/services/newsService";
import { getWeatherContext } from "@/services/weatherService";
import { useAuth } from "@/contexts/AuthContext";
import EmptyState from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";

const SCOPE_LABEL: Record<NewsArticle["scope"], string> = {
  "kenya":       "Kenya",
  "east-africa": "East Africa",
  "global":      "Global",
};

// Auto-refresh threshold — once per day
const AUTO_REFRESH_MS = 24 * 60 * 60 * 1000;

function timeAgo(ts: number): string {
  if (!ts) return "never";
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

const AgriNews = () => {
  const adminArticles = getArticles();
  const { user } = useAuth();
  const [result, setResult]     = useState<NewsResult | null>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const interests  = user?.interests          ?? [];
  const activities = user?.farmingActivities  ?? [];

  const load = useCallback(async (force = false) => {
    if (force) {
      setRefreshing(true);
      clearNewsCache();
    }
    const weather = await getWeatherContext().catch(() => null);
    const r = await fetchAgriNewsWithMeta({
      location:   weather?.location,
      country:    weather?.country ?? user?.country ?? "Kenya",
      limit:      8,
      interests,
      activities,
    });
    setResult(r);
    setLoading(false);
    setRefreshing(false);
  }, [interests.join(","), activities.join(","), user?.country]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
    // Refresh on location change
    const handler = () => load(true);
    window.addEventListener("harvest:location-changed", handler);
    return () => window.removeEventListener("harvest:location-changed", handler);
  }, [load]);

  // Auto-refresh once per day on mount if cache is older than threshold
  useEffect(() => {
    if (result && result.fetchedAt > 0 && Date.now() - result.fetchedAt > AUTO_REFRESH_MS) {
      load(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.fetchedAt]);

  const liveNews   = result?.articles ?? [];
  const hasContent = liveNews.length > 0 || adminArticles.length > 0;
  const isStale    = result?.source === "stale";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-harvest-sky/10 shrink-0">
            <Newspaper className="h-4 w-4 text-harvest-sky" />
          </div>
          <h2 className="harvest-section-title">Agri News</h2>
          {result && result.fetchedAt > 0 && (
            <span className="text-[10px] text-muted-foreground truncate">
              · {isStale ? "cached " : "updated "}{timeAgo(result.fetchedAt)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh news"
            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading && adminArticles.length === 0 ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : !hasContent ? (
        <EmptyState
          icon={Newspaper}
          title="No agricultural news available"
          description="Live news feeds are temporarily unreachable. Tap refresh to try again."
        />
      ) : (
        <div className="space-y-3">
          {/* Admin-curated articles first */}
          {adminArticles.slice(0, 2).map((item) => (
            <div
              key={item.id}
              className="harvest-card p-4 cursor-pointer transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground leading-snug">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {item.authorName} · {item.readTime}
                  </p>
                </div>
                {item.tag && (
                  <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-secondary-foreground">
                    {item.tag}
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Live verified RSS news */}
          {liveNews.slice(0, 5).map((item, idx) => (
            <a
              key={`${item.link}-${idx}`}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="harvest-card block p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
                    {item.title}
                  </h3>
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="truncate">{item.source}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-secondary-foreground">
                  {SCOPE_LABEL[item.scope]}
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default AgriNews;
