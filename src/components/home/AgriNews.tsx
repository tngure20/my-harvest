import { Newspaper, ArrowRight, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { getArticles } from "@/lib/dataService";
import { fetchAgriNews, type NewsArticle } from "@/services/newsService";
import { getWeatherContext } from "@/services/weatherService";
import EmptyState from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";

const SCOPE_LABEL: Record<NewsArticle["scope"], string> = {
  "kenya":       "Kenya",
  "east-africa": "East Africa",
  "global":      "Global",
};

const AgriNews = () => {
  const adminArticles = getArticles();
  const [liveNews, setLiveNews]   = useState<NewsArticle[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Resolve user location first (best-effort, hierarchical)
      const weather = await getWeatherContext().catch(() => null);
      const articles = await fetchAgriNews({
        location: weather?.location,
        country:  weather?.country ?? "Kenya",
        limit:    8,
      });
      if (!cancelled) {
        setLiveNews(articles);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const hasContent = liveNews.length > 0 || adminArticles.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-harvest-sky/10">
            <Newspaper className="h-4 w-4 text-harvest-sky" />
          </div>
          <h2 className="harvest-section-title">Agri News</h2>
        </div>
        {hasContent && (
          <button className="flex items-center gap-1 text-xs font-medium text-primary">
            See all <ArrowRight className="h-3 w-3" />
          </button>
        )}
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
          description="Live news feeds are temporarily unreachable. Please check again shortly."
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
