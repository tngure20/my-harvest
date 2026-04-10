import AppLayout from "@/components/AppLayout";
import { Search, Plus, LogIn, ShoppingBag } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import EmptyState from "@/components/ui/EmptyState";
import ListingCard from "@/components/marketplace/ListingCard";
import ListingDetailSheet from "@/components/marketplace/ListingDetailSheet";
import CreateListingSheet from "@/components/marketplace/CreateListingSheet";
import MarketplaceFilters from "@/components/marketplace/MarketplaceFilters";
import {
  getListings,
  createListing,
  CATEGORIES,
  CATEGORY_ICONS,
  type MarketplaceListing,
  type ListingFilters,
  type ListingCategory,
} from "@/services/marketplaceService";

const Marketplace = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<ListingCategory | "All">("All");
  const [filters, setFilters] = useState<ListingFilters>({});
  const [showCreate, setShowCreate] = useState(false);
  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const mergedFilters: ListingFilters = useMemo(() => ({
    ...filters,
    search: searchQuery || undefined,
    category: activeCategory !== "All" ? activeCategory : filters.category,
  }), [filters, searchQuery, activeCategory]);

  const listings = useMemo(() => getListings(mergedFilters), [mergedFilters, refreshKey]);

  const handleCategoryClick = (cat: ListingCategory | "All") => {
    setActiveCategory(cat);
    if (cat !== "All") setFilters((f) => ({ ...f, category: cat }));
    else setFilters((f) => ({ ...f, category: undefined }));
  };

  const handleFilterApply = (f: ListingFilters) => {
    setFilters(f);
    if (f.category && f.category !== "All") setActiveCategory(f.category as ListingCategory);
    else setActiveCategory("All");
  };

  const handleFilterReset = () => {
    setFilters({});
    setActiveCategory("All");
    setSearchQuery("");
  };

  return (
    <AppLayout wide>
      <div className="px-4 py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Marketplace</h1>
          {isAuthenticated ? (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground active:scale-95 transition-transform">
              <Plus className="h-4 w-4" /> Post
            </button>
          ) : (
            <button onClick={() => navigate("/login")}
              className="flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
              <LogIn className="h-4 w-4" /> Sign in to sell
            </button>
          )}
        </div>

        {/* Search + Filters */}
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
          <MarketplaceFilters filters={filters} onApply={handleFilterApply} onReset={handleFilterReset} />
        </div>

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4">
          <button
            onClick={() => handleCategoryClick("All")}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activeCategory === "All" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryClick(cat)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                activeCategory === cat ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {CATEGORY_ICONS[cat]} {cat}
            </button>
          ))}
        </div>

        {/* Stats */}
        <p className="text-[11px] text-muted-foreground">
          {listings.length} listing{listings.length !== 1 ? "s" : ""}
          {activeCategory !== "All" ? ` in ${activeCategory}` : ""}
          {searchQuery ? ` matching "${searchQuery}"` : ""}
        </p>

        {/* Grid */}
        {listings.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title={searchQuery || activeCategory !== "All" ? "No results found" : "No listings yet"}
            description={searchQuery ? "Try a different search or category." : "Be the first to list a product or service."}
            action={!searchQuery && isAuthenticated ? { label: "Post First Listing", onClick: () => setShowCreate(true) } : undefined}
          />
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {listings.map((item, i) => (
              <ListingCard key={item.id} listing={item} index={i} onClick={() => setSelectedListing(item)} />
            ))}
          </div>
        )}
      </div>

      {/* Create Sheet */}
      {isAuthenticated && user && (
        <CreateListingSheet
          open={showCreate}
          onClose={() => setShowCreate(false)}
          userId={user.id}
          userName={user.name}
          userAvatar={user.avatar}
          defaultLocation={user.location}
          onSubmit={(data) => { createListing(data); setShowCreate(false); refresh(); }}
        />
      )}

      {/* Detail Sheet */}
      <ListingDetailSheet listing={selectedListing} onClose={() => { setSelectedListing(null); refresh(); }} />
    </AppLayout>
  );
};

export default Marketplace;
