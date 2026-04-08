import { useState } from "react";
import { X, SlidersHorizontal, MapPin, Navigation } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CATEGORIES, CATEGORY_ICONS, UNITS, type ListingCategory, type SortOption, type ListingFilters } from "@/services/marketplaceService";

interface Props {
  filters: ListingFilters;
  onApply: (filters: ListingFilters) => void;
  onReset: () => void;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest First" },
  { value: "price_asc", label: "Price: Low → High" },
  { value: "price_desc", label: "Price: High → Low" },
  { value: "nearest", label: "Nearest to Me" },
];

const MarketplaceFilters = ({ filters, onApply, onReset }: Props) => {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<ListingFilters>(filters);
  const [gettingLocation, setGettingLocation] = useState(false);

  const handleOpen = () => { setLocal(filters); setOpen(true); };
  const handleApply = () => { onApply(local); setOpen(false); };
  const handleReset = () => { onReset(); setLocal({}); setOpen(false); };

  const getMyLocation = () => {
    if (!navigator.geolocation) return;
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocal((p) => ({ ...p, lat: pos.coords.latitude, lng: pos.coords.longitude, radiusKm: p.radiusKm || 50 }));
        setGettingLocation(false);
      },
      () => setGettingLocation(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const activeCount = [
    filters.category && filters.category !== "All",
    filters.minPrice !== undefined || filters.maxPrice !== undefined,
    filters.location,
    filters.userType && filters.userType !== "all",
    filters.sort && filters.sort !== "newest",
    filters.lat !== undefined,
  ].filter(Boolean).length;

  return (
    <>
      <button
        onClick={handleOpen}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border bg-card text-muted-foreground hover:bg-muted transition-colors"
      >
        <SlidersHorizontal className="h-4 w-4" />
        {activeCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
            {activeCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm overflow-y-auto bg-card shadow-xl"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-5 py-4">
                <h2 className="font-display text-lg font-bold text-foreground">Filters & Sort</h2>
                <button onClick={() => setOpen(false)} className="rounded-full bg-muted p-1.5">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              <div className="p-5 space-y-6">
                {/* Sort */}
                <div>
                  <label className="mb-2 block text-xs font-semibold text-foreground uppercase tracking-wider">Sort By</label>
                  <div className="grid grid-cols-2 gap-2">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setLocal((p) => ({ ...p, sort: opt.value }))}
                        className={`rounded-xl px-3 py-2 text-xs font-medium border transition-colors ${
                          local.sort === opt.value ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-muted"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="mb-2 block text-xs font-semibold text-foreground uppercase tracking-wider">Category</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setLocal((p) => ({ ...p, category: "All" }))}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                        !local.category || local.category === "All" ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-muted"
                      }`}
                    >
                      All
                    </button>
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setLocal((p) => ({ ...p, category: cat }))}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                          local.category === cat ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-muted"
                        }`}
                      >
                        {CATEGORY_ICONS[cat]} {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price Range */}
                <div>
                  <label className="mb-2 block text-xs font-semibold text-foreground uppercase tracking-wider">Price Range (KSh)</label>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      placeholder="Min"
                      value={local.minPrice ?? ""}
                      onChange={(e) => setLocal((p) => ({ ...p, minPrice: e.target.value ? Number(e.target.value) : undefined }))}
                      className="rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={local.maxPrice ?? ""}
                      onChange={(e) => setLocal((p) => ({ ...p, maxPrice: e.target.value ? Number(e.target.value) : undefined }))}
                      className="rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Location */}
                <div>
                  <label className="mb-2 block text-xs font-semibold text-foreground uppercase tracking-wider">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      value={local.location ?? ""}
                      onChange={(e) => setLocal((p) => ({ ...p, location: e.target.value || undefined }))}
                      placeholder="City or county..."
                      className="w-full rounded-xl border bg-background pl-8 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <button
                    onClick={getMyLocation}
                    disabled={gettingLocation}
                    className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-50"
                  >
                    <Navigation className="h-3 w-3" />
                    {gettingLocation ? "Getting location..." : "Use my location"}
                  </button>
                  {local.lat !== undefined && (
                    <div className="mt-2">
                      <label className="mb-1 block text-[11px] text-muted-foreground">Radius: {local.radiusKm || 50} km</label>
                      <input
                        type="range"
                        min={5}
                        max={200}
                        value={local.radiusKm || 50}
                        onChange={(e) => setLocal((p) => ({ ...p, radiusKm: Number(e.target.value) }))}
                        className="w-full accent-primary"
                      />
                    </div>
                  )}
                </div>

                {/* Seller Type */}
                <div>
                  <label className="mb-2 block text-xs font-semibold text-foreground uppercase tracking-wider">Seller Type</label>
                  <div className="flex gap-2">
                    {(["all", "individual", "business"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setLocal((p) => ({ ...p, userType: t }))}
                        className={`flex-1 rounded-xl px-3 py-2 text-xs font-medium border transition-colors capitalize ${
                          (local.userType || "all") === t ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-muted"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button onClick={handleReset} className="flex-1 rounded-xl border py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors">
                    Reset
                  </button>
                  <button onClick={handleApply} className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground">
                    Apply Filters
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default MarketplaceFilters;
