import AppLayout from "@/components/AppLayout";
import { Search, SlidersHorizontal, MapPin, ShoppingBag, Plus, LogIn, Loader2, Phone } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchListings, createListing } from "@/lib/supabaseService";
import EmptyState from "@/components/ui/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const categories = ["All", "Livestock", "Crops", "Equipment", "Seeds", "Fertilizer", "Services"];

interface CreateListingForm {
  title: string; description: string; price: string; location: string;
  category: string; phone: string; image_url: string;
}

const defaultForm: CreateListingForm = {
  title: "", description: "", price: "", location: "", category: "Crops", phone: "", image_url: "",
};

const Marketplace = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateListingForm>(defaultForm);

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["/api/marketplace"],
    queryFn: fetchListings,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateListingForm) =>
      createListing({ seller_id: user!.id, ...data, image_url: data.image_url || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace"] });
      setShowCreate(false);
      setForm(defaultForm);
    },
  });

  const filtered = useMemo(() => {
    return listings.filter((item) => {
      const matchCategory = activeCategory === "All" || item.category === activeCategory;
      const matchSearch = !searchQuery ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.location.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [listings, activeCategory, searchQuery]);

  return (
    <AppLayout>
      <div className="px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Marketplace</h1>
          {isAuthenticated ? (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              <Plus className="h-4 w-4" /> List Item
            </button>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              <LogIn className="h-4 w-4" /> Sign in to sell
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border bg-card px-3 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products & services..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <button className="flex h-10 w-10 items-center justify-center rounded-xl border bg-card text-muted-foreground">
            <SlidersHorizontal className="h-4 w-4" />
          </button>
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

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="No listings available"
            description={
              listings.length === 0
                ? "No marketplace listings yet. Be the first to list a product or service!"
                : "No results match your search or filter."
            }
            action={isAuthenticated ? { label: "Create Listing", onClick: () => setShowCreate(true) } : undefined}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="harvest-card p-4 cursor-pointer transition-shadow hover:shadow-md"
              >
                {item.imageUrl && (
                  <img src={item.imageUrl} alt={item.title} className="mb-3 w-full rounded-lg object-cover h-32" />
                )}
                <div className="mb-2 flex items-center justify-between">
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                    {item.category}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-foreground leading-snug">{item.title}</h3>
                {item.description && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                )}
                <p className="mt-2 text-lg font-bold text-primary">{item.price}</p>
                <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {item.location} · {item.sellerName}
                </div>
                {item.phone && (
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {item.phone}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50">
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="w-full rounded-t-2xl bg-background p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Create Listing</h2>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground text-sm">Cancel</button>
            </div>

            <div className="space-y-3">
              {[
                { key: "title", label: "Title", placeholder: "e.g. 50kg Maize Bags" },
                { key: "price", label: "Price", placeholder: "e.g. KSh 2,500" },
                { key: "location", label: "Location", placeholder: "e.g. Nakuru, Kenya" },
                { key: "phone", label: "Contact Phone", placeholder: "e.g. 0712345678" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="mb-1 block text-xs font-medium text-foreground">{label}</label>
                  <input
                    value={form[key as keyof CreateListingForm]}
                    onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full rounded-xl border bg-card px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              ))}

              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  className="w-full rounded-xl border bg-card px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                >
                  {categories.filter((c) => c !== "All").map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Describe your product or service..."
                  rows={3}
                  className="w-full rounded-xl border bg-card px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Image URL (optional)</label>
                <input
                  value={form.image_url}
                  onChange={(e) => setForm((p) => ({ ...p, image_url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full rounded-xl border bg-card px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.title.trim() || !form.price.trim() || createMutation.isPending}
              className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish Listing"}
            </button>
          </motion.div>
        </div>
      )}
    </AppLayout>
  );
};

export default Marketplace;
