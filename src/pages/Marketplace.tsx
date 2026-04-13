import AppLayout from "@/components/AppLayout";
import { Search, SlidersHorizontal, MapPin, ShoppingBag, Plus, LogIn, Loader2, Phone } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchListings, createListing } from "@/lib/supabaseService";
import EmptyState from "@/components/ui/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

// DB has no category column — we store category locally in the title/description
// price is numeric in DB, contact_info replaces phone

interface CreateListingForm {
  title: string;
  description: string;
  price: string;     // user enters as string, parsed to number on submit
  location: string;
  contact_info: string;    // matches marketplace_listings.contact_info
  image_url: string;
}

const defaultForm: CreateListingForm = {
  title: "", description: "", price: "", location: "", contact_info: "", image_url: "",
};

const Marketplace = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateListingForm>(defaultForm);

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["/api/marketplace"],
    queryFn: fetchListings,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateListingForm) =>
      createListing({
        user_id: user!.id,                         // marketplace_listings.user_id (NOT seller_id)
        title: data.title,
        description: data.description,
        price: data.price ? parseFloat(data.price) : null,  // numeric in DB
        location: data.location,
        contact_info: data.contact_info,            // marketplace_listings.contact_info (NOT phone)
        image_url: data.image_url || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace"] });
      setShowCreate(false);
      setForm(defaultForm);
    },
    onError: () => {
      // Surface error to user — toast would be ideal but keeping component self-contained
      alert("Failed to create listing. Please try again.");
    },
  });

  const filtered = useMemo(() => {
    if (!searchQuery) return listings;
    const q = searchQuery.toLowerCase();
    return listings.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q)
    );
  }, [listings, searchQuery]);

  const formatPrice = (price: number | null) => {
    if (price === null || price === undefined) return "";
    return `KSh ${price.toLocaleString()}`;
  };

  return (
    <AppLayout>
      <div className="px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Marketplace</h1>
          {isAuthenticated ? (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              data-testid="button-list-item"
            >
              <Plus className="h-4 w-4" /> List Item
            </button>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              data-testid="button-sign-in-marketplace"
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
              placeholder="Search products & services…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              data-testid="input-search-marketplace"
            />
          </div>
          <button className="flex h-10 w-10 items-center justify-center rounded-xl border bg-card text-muted-foreground">
            <SlidersHorizontal className="h-4 w-4" />
          </button>
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
                : "No results match your search."
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
                data-testid={`card-listing-${item.id}`}
              >
                {item.imageUrl && (
                  <img src={item.imageUrl} alt={item.title} className="mb-3 w-full rounded-lg object-cover h-32" />
                )}
                <h3 className="text-sm font-semibold text-foreground leading-snug">{item.title}</h3>
                {item.description && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                )}
                {item.price !== null && (
                  <p className="mt-2 text-lg font-bold text-primary">{formatPrice(item.price)}</p>
                )}
                <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {item.location} · {item.sellerName}
                </div>
                {item.contactInfo && (
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {item.contactInfo}
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
            className="w-full rounded-t-2xl bg-background p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Create Listing</h2>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground text-sm">Cancel</button>
            </div>

            <div className="space-y-3">
              {[
                { key: "title", label: "Title", placeholder: "e.g. 50kg Maize Bags" },
                { key: "price", label: "Price (KSh)", placeholder: "e.g. 2500", type: "number" },
                { key: "location", label: "Location", placeholder: "e.g. Nakuru, Kenya" },
                { key: "contact_info", label: "Contact Info", placeholder: "e.g. 0712345678 or email" },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <label className="mb-1 block text-xs font-medium text-foreground">{label}</label>
                  <input
                    type={type || "text"}
                    value={form[key as keyof CreateListingForm]}
                    onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full rounded-xl border bg-card px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                    data-testid={`input-listing-${key}`}
                  />
                </div>
              ))}

              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Describe your product or service…"
                  rows={3}
                  className="w-full rounded-xl border bg-card px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
                  data-testid="input-listing-description"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Image URL (optional)</label>
                <input
                  value={form.image_url}
                  onChange={(e) => setForm((p) => ({ ...p, image_url: e.target.value }))}
                  placeholder="https://…"
                  className="w-full rounded-xl border bg-card px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                  data-testid="input-listing-image-url"
                />
              </div>
            </div>

            <button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.title.trim() || createMutation.isPending}
              className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40 flex items-center justify-center gap-2"
              data-testid="button-publish-listing"
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
