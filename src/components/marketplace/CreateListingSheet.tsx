import { useState } from "react";
import { X, Phone, MapPin, Tag, DollarSign } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export interface ListingFormData {
  title: string;
  description: string;
  price: string;
  category: string;
  location: string;
  phone: string;
  imageUrl?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ListingFormData) => void;
  defaultLocation?: string;
  defaultPhone?: string;
}

const CATEGORIES = ["Livestock", "Crops", "Equipment", "Seeds", "Fertilizer", "Services", "Other"];

const CreateListingSheet = ({ open, onClose, onSubmit, defaultLocation = "", defaultPhone = "" }: Props) => {
  const empty: ListingFormData = { title: "", description: "", price: "", category: "Crops", location: defaultLocation, phone: defaultPhone, imageUrl: "" };
  const [form, setForm] = useState<ListingFormData>(empty);
  const [errors, setErrors] = useState<Partial<ListingFormData>>({});

  const set = (k: keyof ListingFormData, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  };

  const validate = (): boolean => {
    const e: Partial<ListingFormData> = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.price.trim()) e.price = "Price is required";
    if (!form.location.trim()) e.location = "Location is required";
    if (!form.phone.trim()) e.phone = "Phone number is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit({ ...form, imageUrl: form.imageUrl?.trim() || undefined });
    setForm(empty);
    setErrors({});
    onClose();
  };

  const handleClose = () => {
    setForm(empty);
    setErrors({});
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-2xl bg-card shadow-xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-5 py-4">
              <h2 className="font-display text-lg font-bold text-foreground">Post a Listing</h2>
              <button onClick={handleClose} className="rounded-full bg-muted p-1.5">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Title */}
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">What are you selling? *</label>
                <input
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="e.g., Grade A Friesian Heifer, 50kg Fertilizer Bags..."
                  className={`w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary ${errors.title ? "border-destructive" : ""}`}
                />
                {errors.title && <p className="mt-1 text-[11px] text-destructive">{errors.title}</p>}
              </div>

              {/* Category */}
              <div>
                <label className="mb-2 block text-xs font-medium text-foreground">Category *</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => set("category", cat)}
                      className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                        form.category === cat
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-foreground border-border hover:bg-muted"
                      }`}
                    >
                      <Tag className="h-2.5 w-2.5" /> {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Describe condition, quantity, breed, age, or any details buyers should know..."
                  rows={3}
                  className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              {/* Price + Location row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">Price *</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      value={form.price}
                      onChange={(e) => set("price", e.target.value)}
                      placeholder="KSh 15,000"
                      className={`w-full rounded-xl border bg-background pl-8 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary ${errors.price ? "border-destructive" : ""}`}
                    />
                  </div>
                  {errors.price && <p className="mt-1 text-[11px] text-destructive">{errors.price}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">Location *</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      value={form.location}
                      onChange={(e) => set("location", e.target.value)}
                      placeholder="Nakuru, Kenya"
                      className={`w-full rounded-xl border bg-background pl-8 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary ${errors.location ? "border-destructive" : ""}`}
                    />
                  </div>
                  {errors.location && <p className="mt-1 text-[11px] text-destructive">{errors.location}</p>}
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Contact Phone *</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder="+254 700 000 000"
                    type="tel"
                    className={`w-full rounded-xl border bg-background pl-8 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary ${errors.phone ? "border-destructive" : ""}`}
                  />
                </div>
                {errors.phone && <p className="mt-1 text-[11px] text-destructive">{errors.phone}</p>}
                <p className="mt-1 text-[11px] text-muted-foreground">Buyers will use this number to contact you directly.</p>
              </div>

              {/* Image URL (optional) */}
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Image URL (optional)</label>
                <input
                  value={form.imageUrl ?? ""}
                  onChange={(e) => set("imageUrl", e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <button
                onClick={handleSubmit}
                className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
              >
                Post Listing
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CreateListingSheet;
