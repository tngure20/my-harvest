import { X, Phone, MapPin, Tag, Calendar, User, MessageCircle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { MarketplaceListing } from "@/lib/dataService";

interface Props {
  listing: MarketplaceListing | null;
  onClose: () => void;
}

const ListingDetailSheet = ({ listing, onClose }: Props) => {
  if (!listing) return null;

  const handleCall = () => { window.location.href = `tel:${listing.phone}`; };
  const handleSMS = () => { window.location.href = `sms:${listing.phone}?body=${encodeURIComponent(`Hi, I'm interested in your listing: ${listing.title}`)}`; };
  const handleWhatsApp = () => {
    const msg = encodeURIComponent(`Hi, I saw your listing on Harvest: *${listing.title}* at ${listing.price}. Is it still available?`);
    const phone = listing.phone.replace(/\D/g, "");
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const d = Math.floor(diff / 86400000);
    if (d < 1) return "Today";
    if (d === 1) return "Yesterday";
    return `${d} days ago`;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-2xl bg-card shadow-xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-5 py-4">
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{listing.category}</span>
          <button onClick={onClose} className="rounded-full bg-muted p-1.5">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Image */}
          {listing.imageUrl && (
            <img
              src={listing.imageUrl}
              alt={listing.title}
              className="w-full rounded-xl object-cover max-h-52 bg-muted"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}

          {/* Title + Price */}
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">{listing.title}</h2>
            <p className="mt-1 text-2xl font-bold text-primary">{listing.price}</p>
          </div>

          {/* Description */}
          {listing.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{listing.description}</p>
          )}

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 rounded-xl bg-muted/50 p-3">
              <User className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground">Seller</p>
                <p className="text-xs font-semibold text-foreground">{listing.sellerName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-muted/50 p-3">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground">Location</p>
                <p className="text-xs font-semibold text-foreground">{listing.location}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-muted/50 p-3">
              <Tag className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground">Category</p>
                <p className="text-xs font-semibold text-foreground">{listing.category}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-muted/50 p-3">
              <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground">Posted</p>
                <p className="text-xs font-semibold text-foreground">{timeAgo(listing.createdAt)}</p>
              </div>
            </div>
          </div>

          {/* Contact section */}
          {listing.phone && (
            <div className="rounded-xl border p-4 space-y-3">
              <p className="text-xs font-semibold text-foreground">Contact Seller</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={handleCall}
                  className="flex flex-col items-center gap-1 rounded-xl bg-harvest-green-50 py-3 text-harvest-green-600 hover:bg-harvest-green-100 transition-colors"
                >
                  <Phone className="h-5 w-5" />
                  <span className="text-[10px] font-medium">Call</span>
                </button>
                <button
                  onClick={handleSMS}
                  className="flex flex-col items-center gap-1 rounded-xl bg-primary/10 py-3 text-primary hover:bg-primary/20 transition-colors"
                >
                  <MessageCircle className="h-5 w-5" />
                  <span className="text-[10px] font-medium">SMS</span>
                </button>
                <button
                  onClick={handleWhatsApp}
                  className="flex flex-col items-center gap-1 rounded-xl bg-[#25D366]/10 py-3 text-[#25D366] hover:bg-[#25D366]/20 transition-colors"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                  </svg>
                  <span className="text-[10px] font-medium">WhatsApp</span>
                </button>
              </div>
              <p className="text-center text-[10px] text-muted-foreground">{listing.phone}</p>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ListingDetailSheet;
