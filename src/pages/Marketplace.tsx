import AppLayout from "@/components/AppLayout";
import { Search, SlidersHorizontal, MapPin, ShoppingBag, Plus, LogIn } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useMemo } from "react";
import { getListings, createListing } from "@/lib/dataService";
import type { MarketplaceListing } from "@/lib/dataService";
import EmptyState from "@/components/ui/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import CreateListingSheet from "@/components/marketplace/CreateListingSheet";
import ListingDetailSheet from "@/components/marketplace/ListingDetailSheet";

const categories = ["All", "Livestock", "Crops", "Equipment", "Seeds", "Fertilizer", "Services", "Other"];

const categoryEmoji: Record<string, string> = {
  Livestock: "🐄", Crops: "🌽", Equipment: "🚜", Seeds: "🌱",
  Fertilizer: "🧪", Services: "🛠️", Other: "📦",
};

const Marketplace = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [listings, setListings] = useState<MarketplaceListing[]>(() => getListings());
  const [showCreate, setShowCreate] = useState(false);
  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null);

  const refresh = () => setListings(getListings());

  const filtered = useMemo(() => {
    return listings.filter((item) => {
      const matchCategory = activeCategory === "All" || item.category === activeCategory;
      const matchSearch =
        !searchQuery ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sellerName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [listings, activeCategory, searchQuery]);

  return (
    <AppLayout>
      <div className="px-4 py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Marketplace</h1>
          {isAuthenticated ? (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              <Plus className="h-4 w-4" /> Post
            </button>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              <LogIn className="h-4 w-4" /> Sign in to sell
            </button>
          )}
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border bg-card px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products, sellers, locations..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <button className="flex h-10 w-10 items-center justify-center rounded-xl border bg-card text-muted-foreground">
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>

        {/* Category filter */}
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
              {cat !== "All" && categoryEmoji[cat] ? `${categoryEmoji[cat]} ` : ""}{cat}
            </button>
          ))}
        </div>

        {/* Stats bar */}
        {listings.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            {filtered.length} listing{filtered.length !== 1 ? "s" : ""}
            {activeCategory !== "All" ? ` in ${activeCategory}` : ""}
            {searchQuery ? ` matching "${searchQuery}"` : ""}
          </p>
        )}

        {/* Listings grid */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title={listings.length === 0 ? "No listings yet" : "No results found"}
            description={
              listings.length === 0
                ? "Be the first to list a product or service for other farmers."
                : "Try a different search or category."
            }
            action={
              listings.length === 0 && isAuthenticated
                ? { label: "Post First Listing", onClick: () => setShowCreate(true) }
                : undefined
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setSelectedListing(item)}
                className="harvest-card cursor-pointer overflow-hidden transition-shadow hover:shadow-md active:scale-[0.98]"
              >
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="h-36 w-full object-cover bg-muted"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                <div className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                      {categoryEmoji[item.category] || ""} {item.category}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString("en-KE", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">{item.title}</h3>
                  {item.description && (
                    <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{item.description}</p>
                  )}
                  <p className="mt-2 text-lg font-bold text-primary">{item.price}</p>
                  <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {item.location} · {item.sellerName}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Create listing sheet */}
      <CreateListingSheet
        open={showCreate}
        onClose={() => setShowCreate(false)}
        defaultLocation={user?.location || ""}
        onSubmit={(data) => {
          if (!user) return;
          createListing({
            sellerId: user.id,
            sellerName: user.name,
            title: data.title,
            description: data.description,
            price: data.price,
            category: data.category,
            location: data.location,
            phone: data.phone,
            imageUrl: data.imageUrl,
          });
          setShowCreate(false);
          refresh();
        }}
      />

      {/* Listing detail sheet */}
      {selectedListing && (
        <ListingDetailSheet
          listing={selectedListing}
          onClose={() => setSelectedListing(null)}
        />
      )}
    </AppLayout>
  );
};

export default Marketplace;
