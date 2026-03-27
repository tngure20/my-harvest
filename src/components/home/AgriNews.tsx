import { useState, useEffect } from "react";
import { Newspaper, ArrowRight, ExternalLink, RefreshCw, MapPin, Globe, Microscope } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchAgriNews, clearNewsCache, type NewsItem } from "@/services/newsService";
import { useAuth } from "@/contexts/AuthContext";

const sourceTypeIcon: Record<NewsItem["sourceType"], typeof Globe> = {
  international: Globe,
  national: MapPin,
  research: Microscope,
};

const sourceTypeColor: Record<NewsItem["sourceType"], string> = {
  international: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  national: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  research: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-KE", { month: "short", day: "numeric" });
}

const SkeletonCard = () => (
  <div className="harvest-card p-4 space-y-2 animate-pulse">
    <div className="flex gap-2 items-center">
      <div className="h-4 w-16 rounded-full bg-muted" />
      <div className="h-4 w-10 rounded-full bg-muted" />
    </div>
    <div className="h-4 w-full rounded bg-muted" />
    <div className="h-4 w-4/5 rounded bg-muted" />
    <div className="h-3 w-24 rounded bg-muted" />
  </div>
);

const AgriNews = () => {
  const { user } = useAuth();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const location = user?.location ?? "";

  const load = async (forceRefresh = false) => {
    setLoading(true);
    setError(false);
    if (forceRefresh) clearNewsCache();
    try {
      const items = await fetchAgriNews(location);
      setNews(items);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [location]);

  const visible = expanded ? news : news.slice(0, 4);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-harvest-sky/10">
            <Newspaper className="h-4 w-4 text-harvest-sky" />
          </div>
          <h2 className="harvest-section-title">Agri News</h2>
          {location && (
            <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              <MapPin className="h-2.5 w-2.5" />
              {location.split(",")[0]}
            </span>
          )}
        </div>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="flex items-center gap-1 rounded-full p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40"
          title="Refresh news"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : error && news.length === 0 ? (
        <div className="harvest-card p-6 text-center">
          <Newspaper className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Could not load news right now.</p>
          <button onClick={() => load()} className="mt-3 text-xs text-primary font-medium">Try again</button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <AnimatePresence>
              {visible.map((item, i) => {
                const Icon = sourceTypeIcon[item.sourceType];
                return (
                  <motion.a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="harvest-card block p-4 cursor-pointer transition-shadow hover:shadow-md group"
                  >
                    <div className="flex items-start gap-3">
                      {/* Image thumbnail */}
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="h-16 w-16 shrink-0 rounded-lg object-cover bg-muted"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${sourceTypeColor[item.sourceType]}`}>
                            <Icon className="h-2.5 w-2.5" />
                            {item.source}
                          </span>
                          {item.region === "east-africa" && (
                            <span className="rounded-full bg-harvest-green-100 px-2 py-0.5 text-[10px] font-medium text-harvest-green-600">
                              East Africa
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-semibold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
                          {item.title}
                        </h3>
                        {item.summary && (
                          <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                            {item.summary}
                          </p>
                        )}
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">{timeAgo(item.publishedAt)}</span>
                          <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  </motion.a>
                );
              })}
            </AnimatePresence>
          </div>

          {news.length > 4 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl border bg-card py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              {expanded ? "Show less" : `Show ${news.length - 4} more articles`}
              <ArrowRight className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`} />
            </button>
          )}

          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            Sources: The Guardian, FAO, CIMMYT · Updates every 30 min
          </p>
        </>
      )}
    </motion.div>
  );
};

export default AgriNews;
