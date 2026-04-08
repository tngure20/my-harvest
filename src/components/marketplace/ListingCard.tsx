import { MapPin, Heart, Star, MessageCircle, Building2, User as UserIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import type { MarketplaceListing } from "@/services/marketplaceService";
import { getReactionCounts, getCommentCount, CATEGORY_ICONS, type ListingCategory } from "@/services/marketplaceService";

interface Props {
  listing: MarketplaceListing;
  index: number;
  onClick: () => void;
}

function formatPrice(price: number): string {
  return `KSh ${price.toLocaleString("en-KE")}`;
}

const ListingCard = ({ listing, index, onClick }: Props) => {
  const [imgError, setImgError] = useState(false);
  const counts = getReactionCounts(listing.id);
  const commentCount = getCommentCount(listing.id);
  const mainImage = listing.image_urls?.[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      onClick={onClick}
      className="group cursor-pointer overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        {mainImage && !imgError ? (
          <img
            src={mainImage}
            alt={listing.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">
            {CATEGORY_ICONS[listing.category as ListingCategory] || "📦"}
          </div>
        )}

        {/* Featured badge */}
        {listing.is_featured && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
            <Star className="h-2.5 w-2.5" /> Featured
          </span>
        )}

        {/* Image count */}
        {listing.image_urls.length > 1 && (
          <span className="absolute right-2 top-2 rounded-full bg-foreground/60 px-2 py-0.5 text-[10px] font-medium text-background">
            +{listing.image_urls.length - 1}
          </span>
        )}

        {/* Category pill */}
        <span className="absolute bottom-2 left-2 rounded-full bg-card/90 backdrop-blur-sm px-2.5 py-0.5 text-[10px] font-medium text-foreground">
          {CATEGORY_ICONS[listing.category as ListingCategory] || ""} {listing.category}
        </span>
      </div>

      {/* Content */}
      <div className="p-3.5">
        <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">{listing.title}</h3>

        <p className="mt-1.5 text-lg font-bold text-primary">
          {formatPrice(listing.price)}
          <span className="text-xs font-normal text-muted-foreground">/{listing.unit}</span>
        </p>

        {/* Seller info */}
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {listing.user_type === "business" ? (
            <Building2 className="h-3 w-3 text-accent" />
          ) : (
            <UserIcon className="h-3 w-3" />
          )}
          <span className="truncate">{listing.seller_name}</span>
          <span className="text-border">·</span>
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{listing.location_name}</span>
        </div>

        {/* Stats row */}
        <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
          {counts.like > 0 && (
            <span className="flex items-center gap-0.5">
              <Heart className="h-3 w-3" /> {counts.like}
            </span>
          )}
          {commentCount > 0 && (
            <span className="flex items-center gap-0.5">
              <MessageCircle className="h-3 w-3" /> {commentCount}
            </span>
          )}
          {listing.availability > 0 && (
            <span className="ml-auto text-[10px] text-primary font-medium">
              {listing.availability} {listing.unit}{listing.availability !== 1 ? "s" : ""} available
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ListingCard;
