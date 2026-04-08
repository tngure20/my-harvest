import { useState } from "react";
import { X, Phone, MapPin, Tag, DollarSign, Plus, Image, Video, Navigation, Package } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { CATEGORIES, CATEGORY_ICONS, UNITS, type ListingCategory, type UserType, type CreateListingInput } from "@/services/marketplaceService";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateListingInput) => void;
  defaultLocation?: string;
  defaultPhone?: string;
  userId: string;
  userName: string;
  userAvatar?: string;
}

interface FormState {
  title: string;
  description: string;
  price: string;
  unit: string;
  category: ListingCategory;
  location_name: string;
  latitude?: number;
  longitude?: number;
  phone: string;
  image_urls: string[];
  video_url: string;
  availability: string;
  user_type: UserType;
}

const CreateListingSheet = ({ open, onClose, onSubmit, defaultLocation = "", defaultPhone = "", userId, userName, userAvatar }: Props) => {
  const empty: FormState = {
    title: "", description: "", price: "", unit: "kg", category: "Produce",
    location_name: defaultLocation, phone: defaultPhone,
    image_urls: [], video_url: "", availability: "1", user_type: "individual",
  };
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [newImageUrl, setNewImageUrl] = useState("");
  const [gettingGPS, setGettingGPS] = useState(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  };

  const addImage = () => {
    const url = newImageUrl.trim();
    if (!url) return;
    if (form.image_urls.length >= 5) return;
    set("image_urls", [...form.image_urls, url]);
    setNewImageUrl("");
  };

  const removeImage = (idx: number) => {
    set("image_urls", form.image_urls.filter((_, i) => i !== idx));
  };

  const getGPS = () => {
    if (!navigator.geolocation) return;
    setGettingGPS(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((p) => ({ ...p, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
        setGettingGPS(false);
      },
      () => setGettingGPS(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.title.trim()) e.title = "Required";
    if (!form.price.trim() || isNaN(Number(form.price))) e.price = "Valid price required";
    if (!form.location_name.trim()) e.location_name = "Required";
    if (!form.availability.trim() || isNaN(Number(form.availability)) || Number(form.availability) < 1) e.availability = "Min 1";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit({
      user_id: userId,
      seller_name: userName,
      seller_avatar: userAvatar,
      user_type: form.user_type,
      title: form.title.trim(),
      description: form.description.trim(),
      image_urls: form.image_urls,
      video_url: form.video_url.trim() || undefined,
      price: Number(form.price),
      unit: form.unit,
      category: form.category,
      location_name: form.location_name.trim(),
      latitude: form.latitude,
      longitude: form.longitude,
      availability: Number(form.availability),
      phone: form.phone.trim() || undefined,
    });
    setForm(empty);
    setErrors({});
    onClose();
  };

  const handleClose = () => { setForm(empty); setErrors({}); onClose(); };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm" onClick={handleClose} />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[95vh] overflow-y-auto rounded-t-2xl bg-card shadow-xl md:left-auto md:w-[520px]"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-5 py-4">
              <h2 className="font-display text-lg font-bold text-foreground">Post a Listing</h2>
              <button onClick={handleClose} className="rounded-full bg-muted p-1.5"><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>

            <div className="p-5 space-y-4">
              {/* Seller Type */}
              <div>
                <label className="mb-2 block text-xs font-medium text-foreground">I'm posting as</label>
                <div className="flex gap-2">
                  {(["individual", "business"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => set("user_type", t)}
                      className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-medium border transition-colors capitalize ${
                        form.user_type === t ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <Field label="What are you selling? *" error={errors.title}>
                <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g., Grade A Friesian Heifer" maxLength={120}
                  className={`w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary ${errors.title ? "border-destructive" : ""}`} />
              </Field>

              {/* Category */}
              <div>
                <label className="mb-2 block text-xs font-medium text-foreground">Category *</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button key={cat} type="button" onClick={() => set("category", cat)}
                      className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                        form.category === cat ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {CATEGORY_ICONS[cat]} {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <Field label="Description">
                <textarea value={form.description} onChange={(e) => set("description", e.target.value)}
                  placeholder="Describe condition, quantity, breed, age, or any details..." rows={3} maxLength={2000}
                  className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary resize-none" />
              </Field>

              {/* Price + Unit + Availability */}
              <div className="grid grid-cols-3 gap-3">
                <Field label="Price (KSh) *" error={errors.price}>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="15000" type="number" min={0}
                      className={`w-full rounded-xl border bg-background pl-8 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary ${errors.price ? "border-destructive" : ""}`} />
                  </div>
                </Field>
                <Field label="Unit *">
                  <select value={form.unit} onChange={(e) => set("unit", e.target.value)}
                    className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary">
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </Field>
                <Field label="Stock *" error={errors.availability}>
                  <div className="relative">
                    <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input value={form.availability} onChange={(e) => set("availability", e.target.value)} placeholder="1" type="number" min={1}
                      className={`w-full rounded-xl border bg-background pl-8 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary ${errors.availability ? "border-destructive" : ""}`} />
                  </div>
                </Field>
              </div>

              {/* Location */}
              <Field label="Location *" error={errors.location_name}>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input value={form.location_name} onChange={(e) => set("location_name", e.target.value)} placeholder="Nakuru, Kenya"
                    className={`w-full rounded-xl border bg-background pl-8 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary ${errors.location_name ? "border-destructive" : ""}`} />
                </div>
                <button onClick={getGPS} disabled={gettingGPS}
                  className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-primary hover:underline disabled:opacity-50">
                  <Navigation className="h-3 w-3" />
                  {gettingGPS ? "Getting GPS..." : form.latitude ? `📍 GPS set (${form.latitude.toFixed(4)}, ${form.longitude?.toFixed(4)})` : "Add GPS coordinates"}
                </button>
              </Field>

              {/* Images */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Images (up to 5)</label>
                {form.image_urls.length > 0 && (
                  <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                    {form.image_urls.map((url, i) => (
                      <div key={i} className="relative shrink-0 h-16 w-16 rounded-lg overflow-hidden bg-muted">
                        <img src={url} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = ""; }} />
                        <button onClick={() => removeImage(i)} className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5">
                          <X className="h-2.5 w-2.5 text-destructive-foreground" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {form.image_urls.length < 5 && (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Image className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addImage()}
                        placeholder="Paste image URL..." className="w-full rounded-xl border bg-background pl-8 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <button onClick={addImage} className="rounded-xl bg-muted px-3 py-2.5 text-muted-foreground hover:bg-muted/80">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Video */}
              <Field label="Video URL (optional)">
                <div className="relative">
                  <Video className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input value={form.video_url} onChange={(e) => set("video_url", e.target.value)} placeholder="YouTube or direct video link"
                    className="w-full rounded-xl border bg-background pl-8 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </Field>

              {/* Phone */}
              <Field label="Contact Phone (optional)">
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+254 700 000 000" type="tel"
                    className="w-full rounded-xl border bg-background pl-8 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">Pulled from your profile if available.</p>
              </Field>

              <button onClick={handleSubmit} className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground active:scale-[0.98] transition-transform">
                Post Listing
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-foreground">{label}</label>
      {children}
      {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

export default CreateListingSheet;
