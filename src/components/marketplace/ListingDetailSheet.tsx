import { useState, useRef, useEffect } from "react";
import { X, Phone, MapPin, Tag, Calendar, Heart, ThumbsDown, Bookmark, MessageCircle, Share2, Building2, User as UserIcon, ChevronLeft, ChevronRight, Play, Send, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import {
  type MarketplaceListing,
  type MarketplaceComment,
  getReactionCounts,
  getUserReactions,
  toggleReaction,
  getComments,
  addComment,
  deleteComment,
  CATEGORY_ICONS,
  type ListingCategory,
  type ReactionType,
} from "@/services/marketplaceService";
import { toast } from "sonner";

interface Props {
  listing: MarketplaceListing | null;
  onClose: () => void;
}

function formatPrice(price: number): string {
  return `KSh ${price.toLocaleString("en-KE")}`;
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

const ListingDetailSheet = ({ listing, onClose }: Props) => {
  const { user, isAuthenticated } = useAuth();
  const [currentImage, setCurrentImage] = useState(0);
  const [comments, setComments] = useState<MarketplaceComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [reactions, setReactions] = useState<Record<ReactionType, number>>({ like: 0, dislike: 0, favorite: 0 });
  const [userReactions, setUserReactions] = useState<ReactionType[]>([]);
  const commentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!listing) return;
    setCurrentImage(0);
    setReactions(getReactionCounts(listing.id));
    setComments(getComments(listing.id));
    if (user) setUserReactions(getUserReactions(listing.id, user.id));
  }, [listing, user]);

  if (!listing) return null;

  const handleReaction = (type: ReactionType) => {
    if (!user) { toast.error("Sign in to interact"); return; }
    const result = toggleReaction(listing.id, user.id, type);
    setReactions(getReactionCounts(listing.id));
    setUserReactions(getUserReactions(listing.id, user.id));
    if (type === "favorite") toast.success(result.added ? "Added to favorites" : "Removed from favorites");
  };

  const handleComment = () => {
    if (!user) { toast.error("Sign in to comment"); return; }
    const text = newComment.trim();
    if (!text) return;
    addComment(listing.id, user.id, user.name, text, user.avatar);
    setComments(getComments(listing.id));
    setNewComment("");
  };

  const handleDeleteComment = (commentId: string) => {
    if (!user) return;
    deleteComment(commentId, user.id);
    setComments(getComments(listing.id));
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/marketplace?listing=${listing.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: listing.title, text: `Check out: ${listing.title} - ${formatPrice(listing.price)}`, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    }
  };

  const handleCall = () => { if (listing.phone) window.location.href = `tel:${listing.phone}`; };
  const handleWhatsApp = () => {
    if (!listing.phone) return;
    const msg = encodeURIComponent(`Hi, I saw your listing on Harvest: *${listing.title}* at ${formatPrice(listing.price)}. Is it still available?`);
    const phone = listing.phone.replace(/\D/g, "");
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  };

  const images = listing.image_urls.length > 0 ? listing.image_urls : [];
  const hasMultipleImages = images.length > 1;

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
        className="fixed bottom-0 left-0 right-0 z-50 max-h-[95vh] overflow-y-auto rounded-t-2xl bg-card shadow-xl md:left-auto md:w-[520px]"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card/95 backdrop-blur-sm px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {CATEGORY_ICONS[listing.category as ListingCategory]} {listing.category}
            </span>
            {listing.user_type === "business" && (
              <span className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
                <Building2 className="h-2.5 w-2.5" /> Business
              </span>
            )}
          </div>
          <button onClick={onClose} className="rounded-full bg-muted p-1.5 hover:bg-muted/80 transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Image Carousel */}
          {images.length > 0 && (
            <div className="relative">
              <div className="aspect-[16/10] overflow-hidden bg-muted">
                <img
                  src={images[currentImage]}
                  alt={`${listing.title} - Image ${currentImage + 1}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
              {hasMultipleImages && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); setCurrentImage((p) => (p - 1 + images.length) % images.length); }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-card/80 p-1.5 backdrop-blur-sm"
                  >
                    <ChevronLeft className="h-4 w-4 text-foreground" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setCurrentImage((p) => (p + 1) % images.length); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-card/80 p-1.5 backdrop-blur-sm"
                  >
                    <ChevronRight className="h-4 w-4 text-foreground" />
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        onClick={(e) => { e.stopPropagation(); setCurrentImage(i); }}
                        className={`h-1.5 rounded-full transition-all ${i === currentImage ? "w-4 bg-primary-foreground" : "w-1.5 bg-primary-foreground/50"}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Video */}
          {listing.video_url && (
            <div className="px-5">
              <a
                href={listing.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl bg-muted/50 p-3 text-sm font-medium text-primary hover:bg-muted transition-colors"
              >
                <Play className="h-4 w-4" /> Watch Video
              </a>
            </div>
          )}

          <div className="px-5 space-y-4 pb-6">
            {/* Title + Price */}
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">{listing.title}</h2>
              <p className="mt-1 text-2xl font-bold text-primary">
                {formatPrice(listing.price)}
                <span className="text-sm font-normal text-muted-foreground">/{listing.unit}</span>
              </p>
            </div>

            {/* Interaction Bar */}
            <div className="flex items-center gap-1 rounded-xl bg-muted/40 p-1.5">
              <button
                onClick={() => handleReaction("like")}
                className={`flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${userReactions.includes("like") ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"}`}
              >
                <Heart className={`h-4 w-4 ${userReactions.includes("like") ? "fill-current" : ""}`} /> {reactions.like || ""}
              </button>
              <button
                onClick={() => handleReaction("dislike")}
                className={`flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${userReactions.includes("dislike") ? "bg-destructive/15 text-destructive" : "text-muted-foreground hover:bg-muted"}`}
              >
                <ThumbsDown className={`h-4 w-4 ${userReactions.includes("dislike") ? "fill-current" : ""}`} /> {reactions.dislike || ""}
              </button>
              <button
                onClick={() => { setShowComments(!showComments); if (!showComments) setTimeout(() => commentInputRef.current?.focus(), 200); }}
                className={`flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${showComments ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"}`}
              >
                <MessageCircle className="h-4 w-4" /> {comments.length || ""}
              </button>
              <button
                onClick={() => handleReaction("favorite")}
                className={`flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${userReactions.includes("favorite") ? "bg-accent/20 text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                <Bookmark className={`h-4 w-4 ${userReactions.includes("favorite") ? "fill-current" : ""}`} />
              </button>
              <button
                onClick={handleShare}
                className="ml-auto flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                <Share2 className="h-4 w-4" />
              </button>
            </div>

            {/* Description */}
            {listing.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{listing.description}</p>
            )}

            {/* Meta Grid */}
            <div className="grid grid-cols-2 gap-3">
              <MetaItem icon={<UserIcon className="h-4 w-4" />} label="Seller" value={listing.seller_name} />
              <MetaItem icon={<MapPin className="h-4 w-4" />} label="Location" value={listing.location_name} />
              <MetaItem icon={<Tag className="h-4 w-4" />} label="Availability" value={`${listing.availability} ${listing.unit}${listing.availability !== 1 ? "s" : ""}`} />
              <MetaItem icon={<Calendar className="h-4 w-4" />} label="Posted" value={timeAgo(listing.created_at)} />
            </div>

            {/* Comments Section */}
            <AnimatePresence>
              {showComments && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-xl border p-4 space-y-3">
                    <p className="text-xs font-semibold text-foreground">Comments ({comments.length})</p>
                    
                    {/* Comment input */}
                    {isAuthenticated ? (
                      <div className="flex gap-2">
                        <input
                          ref={commentInputRef}
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleComment()}
                          placeholder="Write a comment..."
                          className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                          maxLength={500}
                        />
                        <button
                          onClick={handleComment}
                          disabled={!newComment.trim()}
                          className="rounded-xl bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Sign in to comment</p>
                    )}

                    {/* Comments list */}
                    <div className="max-h-60 overflow-y-auto space-y-3">
                      {comments.length === 0 ? (
                        <p className="text-center text-xs text-muted-foreground py-4">No comments yet. Be the first!</p>
                      ) : (
                        comments.map((c) => (
                          <div key={c.id} className="flex gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                              {c.author_avatar || c.author_name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-foreground">{c.author_name}</span>
                                <span className="text-[10px] text-muted-foreground">{timeAgo(c.created_at)}</span>
                                {user?.id === c.user_id && (
                                  <button onClick={() => handleDeleteComment(c.id)} className="ml-auto text-muted-foreground hover:text-destructive">
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed">{c.text}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Contact section */}
            {listing.phone && (
              <div className="rounded-xl border p-4 space-y-3">
                <p className="text-xs font-semibold text-foreground">Contact Seller</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleCall}
                    className="flex flex-col items-center gap-1 rounded-xl bg-primary/10 py-3 text-primary hover:bg-primary/20 transition-colors"
                  >
                    <Phone className="h-5 w-5" />
                    <span className="text-[10px] font-medium">Call</span>
                  </button>
                  <button
                    onClick={handleWhatsApp}
                    className="flex flex-col items-center gap-1 rounded-xl bg-[hsl(142,70%,45%)]/10 py-3 text-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,45%)]/20 transition-colors"
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
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

function MetaItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-muted/50 p-3">
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-xs font-semibold text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}

export default ListingDetailSheet;
