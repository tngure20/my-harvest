import AppLayout from "@/components/AppLayout";
import { Search, X, MapPin, Users, ShoppingBag, BookOpen, UserCheck } from "lucide-react";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

const categories = ["All", "Farmers", "Posts", "Groups", "Marketplace", "Experts", "Articles"] as const;
type Category = (typeof categories)[number];

interface SearchResult {
  id: string;
  category: Exclude<Category, "All">;
  title: string;
  subtitle: string;
  extra?: string;
}

const allResults: SearchResult[] = [
  { id: "f1", category: "Farmers", title: "Jane Wanjiku", subtitle: "Kiambu · Crop Farming", extra: "156 followers" },
  { id: "f2", category: "Farmers", title: "Peter Ochieng", subtitle: "Kisumu · Livestock", extra: "89 followers" },
  { id: "f3", category: "Farmers", title: "Mary Akinyi", subtitle: "Nakuru · Mixed Farming", extra: "210 followers" },
  { id: "p1", category: "Posts", title: "Tips for drought-resistant maize varieties", subtitle: "Posted by James K. · 2h ago" },
  { id: "p2", category: "Posts", title: "My first avocado harvest — lessons learned", subtitle: "Posted by Grace N. · 5h ago" },
  { id: "p3", category: "Posts", title: "Solar-powered irrigation pump review", subtitle: "Posted by David M. · 1d ago" },
  { id: "g1", category: "Groups", title: "Dairy Farming Kenya", subtitle: "2,340 members · 156 posts/week" },
  { id: "g2", category: "Groups", title: "Poultry Farmers Network", subtitle: "1,890 members · 98 posts/week" },
  { id: "m1", category: "Marketplace", title: "Grade Holstein Friesian Dairy Cow", subtitle: "KSh 120,000 · Nyandarua" },
  { id: "m2", category: "Marketplace", title: "Fresh Organic Avocados — 100kg", subtitle: "KSh 8,000 · Murang'a" },
  { id: "m3", category: "Marketplace", title: "2-Acre Drip Irrigation Kit", subtitle: "KSh 45,000 · Nairobi" },
  { id: "e1", category: "Experts", title: "Dr. Sarah Akinyi", subtitle: "Veterinarian · Kiambu" },
  { id: "e2", category: "Experts", title: "James Oduor", subtitle: "Agronomist · Nakuru" },
  { id: "a1", category: "Articles", title: "Complete Guide to Drip Irrigation", subtitle: "By AgroKnowledge · 5 min read" },
  { id: "a2", category: "Articles", title: "Preventing Fall Armyworm in Maize", subtitle: "By KALRO · 8 min read" },
];

const categoryIcons: Record<string, React.ElementType> = {
  Farmers: Users,
  Posts: BookOpen,
  Groups: Users,
  Marketplace: ShoppingBag,
  Experts: UserCheck,
  Articles: BookOpen,
};

const SearchPage = () => {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("All");

  const filtered = useMemo(() => {
    let results = allResults;
    if (activeCategory !== "All") {
      results = results.filter((r) => r.category === activeCategory);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      results = results.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.subtitle.toLowerCase().includes(q)
      );
    }
    return results;
  }, [query, activeCategory]);

  const groupedResults = useMemo(() => {
    if (activeCategory !== "All") return { [activeCategory]: filtered };
    const groups: Record<string, SearchResult[]> = {};
    filtered.forEach((r) => {
      if (!groups[r.category]) groups[r.category] = [];
      groups[r.category].push(r);
    });
    return groups;
  }, [filtered, activeCategory]);

  return (
    <AppLayout>
      <div className="px-4 py-4 space-y-4">
        <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-3">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search farmers, posts, products, experts..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {!query.trim() && (
          <div className="py-12 text-center">
            <Search className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="mt-3 text-sm text-muted-foreground">
              Start typing to search across the platform
            </p>
          </div>
        )}

        {query.trim() && filtered.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No results found for "{query}"
            </p>
          </div>
        )}

        <AnimatePresence>
          {query.trim() && filtered.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              {Object.entries(groupedResults).map(([category, results]) => {
                const Icon = categoryIcons[category] || Search;
                return (
                  <div key={category}>
                    <div className="mb-2 flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold text-foreground">{category}</h3>
                      <span className="text-[11px] text-muted-foreground">({results.length})</span>
                    </div>
                    <div className="space-y-1.5">
                      {results.map((result, i) => (
                        <motion.div
                          key={result.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.02 }}
                          className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-muted/50 cursor-pointer"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{result.title}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{result.subtitle}</p>
                          </div>
                          {result.extra && (
                            <span className="shrink-0 text-[11px] text-muted-foreground">{result.extra}</span>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
};

export default SearchPage;
