/**
 * Marketplace Service Layer
 * localStorage-backed, structured to mirror Supabase tables.
 * Replace function bodies with supabase.from('marketplace_listings')... when connected.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ListingCategory = "Seeds" | "Tools" | "Produce" | "Livestock" | "Fertilizer" | "Equipment" | "Services" | "Other";
export type UserType = "individual" | "business";
export type ReactionType = "like" | "dislike" | "favorite";
export type SortOption = "newest" | "price_asc" | "price_desc" | "nearest";

export interface MarketplaceListing {
  id: string;
  user_id: string;
  seller_name: string;
  seller_avatar?: string;
  user_type: UserType;
  title: string;
  description: string;
  image_urls: string[];
  video_url?: string;
  price: number;
  unit: string;
  category: ListingCategory;
  location_name: string;
  latitude?: number;
  longitude?: number;
  availability: number;
  phone?: string;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceReaction {
  id: string;
  listing_id: string;
  user_id: string;
  type: ReactionType;
  created_at: string;
}

export interface MarketplaceComment {
  id: string;
  listing_id: string;
  user_id: string;
  author_name: string;
  author_avatar?: string;
  text: string;
  created_at: string;
}

export interface ListingFilters {
  search?: string;
  category?: ListingCategory | "All";
  minPrice?: number;
  maxPrice?: number;
  location?: string;
  userType?: UserType | "all";
  sort?: SortOption;
  lat?: number;
  lng?: number;
  radiusKm?: number;
}

export interface CreateListingInput {
  user_id: string;
  seller_name: string;
  seller_avatar?: string;
  user_type: UserType;
  title: string;
  description: string;
  image_urls: string[];
  video_url?: string;
  price: number;
  unit: string;
  category: ListingCategory;
  location_name: string;
  latitude?: number;
  longitude?: number;
  availability: number;
  phone?: string;
  is_featured?: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const LISTINGS_KEY = "harvest_marketplace_listings";
const REACTIONS_KEY = "harvest_marketplace_reactions";
const COMMENTS_KEY = "harvest_marketplace_comments";

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

function load<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
}
function save<T>(key: string, data: T[]) { localStorage.setItem(key, JSON.stringify(data)); }

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── One-time cleanup: remove any previously seeded fake listings ──────────────

function purgeSeedData() {
  const PURGE_KEY = "harvest_marketplace_seed_purged_v1";
  if (localStorage.getItem(PURGE_KEY)) return;
  try {
    const listings = load<MarketplaceListing>(LISTINGS_KEY);
    const cleaned = listings.filter((l) => !l.user_id.startsWith("seed-"));
    save(LISTINGS_KEY, cleaned);
    localStorage.setItem(PURGE_KEY, "1");
  } catch {}
}

// ─── Listings CRUD ─────────────────────────────────────────────────────────────

export function getListings(filters?: ListingFilters): MarketplaceListing[] {
  purgeSeedData();
  let items = load<MarketplaceListing>(LISTINGS_KEY);

  if (filters) {
    if (filters.category && filters.category !== "All") {
      items = items.filter((i) => i.category === filters.category);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      items = items.filter((i) =>
        i.title.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.location_name.toLowerCase().includes(q) ||
        i.seller_name.toLowerCase().includes(q)
      );
    }
    if (filters.minPrice !== undefined) items = items.filter((i) => i.price >= filters.minPrice!);
    if (filters.maxPrice !== undefined) items = items.filter((i) => i.price <= filters.maxPrice!);
    if (filters.location) {
      const loc = filters.location.toLowerCase();
      items = items.filter((i) => i.location_name.toLowerCase().includes(loc));
    }
    if (filters.userType && filters.userType !== "all") {
      items = items.filter((i) => i.user_type === filters.userType);
    }
    if (filters.lat !== undefined && filters.lng !== undefined && filters.radiusKm) {
      items = items.filter((i) =>
        i.latitude !== undefined && i.longitude !== undefined &&
        haversineKm(filters.lat!, filters.lng!, i.latitude, i.longitude) <= filters.radiusKm!
      );
    }

    // Sort
    switch (filters.sort) {
      case "price_asc": items.sort((a, b) => a.price - b.price); break;
      case "price_desc": items.sort((a, b) => b.price - a.price); break;
      case "nearest":
        if (filters.lat !== undefined && filters.lng !== undefined) {
          items.sort((a, b) => {
            const dA = a.latitude != null && a.longitude != null ? haversineKm(filters.lat!, filters.lng!, a.latitude, a.longitude) : Infinity;
            const dB = b.latitude != null && b.longitude != null ? haversineKm(filters.lat!, filters.lng!, b.latitude, b.longitude) : Infinity;
            return dA - dB;
          });
        }
        break;
      default: items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  } else {
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  // Featured items first
  const featured = items.filter((i) => i.is_featured);
  const regular = items.filter((i) => !i.is_featured);
  return [...featured, ...regular];
}

export function getListingById(id: string): MarketplaceListing | undefined {
  return load<MarketplaceListing>(LISTINGS_KEY).find((l) => l.id === id);
}

export function createListing(input: CreateListingInput): MarketplaceListing {
  const items = load<MarketplaceListing>(LISTINGS_KEY);
  const listing: MarketplaceListing = {
    ...input,
    id: uid(),
    is_featured: input.is_featured ?? false,
    created_at: now(),
    updated_at: now(),
  };
  items.unshift(listing);
  save(LISTINGS_KEY, items);
  return listing;
}

export function updateListing(id: string, userId: string, updates: Partial<CreateListingInput>): boolean {
  const items = load<MarketplaceListing>(LISTINGS_KEY);
  const idx = items.findIndex((i) => i.id === id && i.user_id === userId);
  if (idx === -1) return false;
  items[idx] = { ...items[idx], ...updates, updated_at: now() };
  save(LISTINGS_KEY, items);
  return true;
}

export function deleteListing(id: string, userId: string): boolean {
  const items = load<MarketplaceListing>(LISTINGS_KEY);
  const filtered = items.filter((i) => !(i.id === id && i.user_id === userId));
  if (filtered.length === items.length) return false;
  save(LISTINGS_KEY, filtered);
  // Clean up reactions and comments
  save(REACTIONS_KEY, load<MarketplaceReaction>(REACTIONS_KEY).filter((r) => r.listing_id !== id));
  save(COMMENTS_KEY, load<MarketplaceComment>(COMMENTS_KEY).filter((c) => c.listing_id !== id));
  return true;
}

// ─── Reactions ─────────────────────────────────────────────────────────────────

export function toggleReaction(listingId: string, userId: string, type: ReactionType): { added: boolean } {
  const reactions = load<MarketplaceReaction>(REACTIONS_KEY);
  const existing = reactions.findIndex((r) => r.listing_id === listingId && r.user_id === userId && r.type === type);
  if (existing !== -1) {
    reactions.splice(existing, 1);
    save(REACTIONS_KEY, reactions);
    return { added: false };
  }
  // Remove opposite reaction (like/dislike are mutually exclusive)
  const opposite = type === "like" ? "dislike" : type === "dislike" ? "like" : null;
  const cleaned = opposite ? reactions.filter((r) => !(r.listing_id === listingId && r.user_id === userId && r.type === opposite)) : reactions;
  cleaned.push({ id: uid(), listing_id: listingId, user_id: userId, type, created_at: now() });
  save(REACTIONS_KEY, cleaned);
  return { added: true };
}

export function getReactionCounts(listingId: string): Record<ReactionType, number> {
  const reactions = load<MarketplaceReaction>(REACTIONS_KEY);
  const forListing = reactions.filter((r) => r.listing_id === listingId);
  return {
    like: forListing.filter((r) => r.type === "like").length,
    dislike: forListing.filter((r) => r.type === "dislike").length,
    favorite: forListing.filter((r) => r.type === "favorite").length,
  };
}

export function getUserReactions(listingId: string, userId: string): ReactionType[] {
  return load<MarketplaceReaction>(REACTIONS_KEY)
    .filter((r) => r.listing_id === listingId && r.user_id === userId)
    .map((r) => r.type);
}

export function getUserFavorites(userId: string): string[] {
  return load<MarketplaceReaction>(REACTIONS_KEY)
    .filter((r) => r.user_id === userId && r.type === "favorite")
    .map((r) => r.listing_id);
}

// ─── Comments ──────────────────────────────────────────────────────────────────

export function getComments(listingId: string): MarketplaceComment[] {
  return load<MarketplaceComment>(COMMENTS_KEY)
    .filter((c) => c.listing_id === listingId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function addComment(listingId: string, userId: string, authorName: string, text: string, authorAvatar?: string): MarketplaceComment {
  const comments = load<MarketplaceComment>(COMMENTS_KEY);
  const comment: MarketplaceComment = {
    id: uid(), listing_id: listingId, user_id: userId, author_name: authorName, author_avatar: authorAvatar, text, created_at: now(),
  };
  comments.push(comment);
  save(COMMENTS_KEY, comments);
  return comment;
}

export function deleteComment(commentId: string, userId: string): boolean {
  const comments = load<MarketplaceComment>(COMMENTS_KEY);
  const filtered = comments.filter((c) => !(c.id === commentId && c.user_id === userId));
  if (filtered.length === comments.length) return false;
  save(COMMENTS_KEY, filtered);
  return true;
}

export function getCommentCount(listingId: string): number {
  return load<MarketplaceComment>(COMMENTS_KEY).filter((c) => c.listing_id === listingId).length;
}

// ─── Categories ────────────────────────────────────────────────────────────────

export const CATEGORIES: ListingCategory[] = ["Seeds", "Tools", "Produce", "Livestock", "Fertilizer", "Equipment", "Services", "Other"];

export const CATEGORY_ICONS: Record<ListingCategory, string> = {
  Seeds: "🌱", Tools: "🔧", Produce: "🥬", Livestock: "🐄",
  Fertilizer: "🧪", Equipment: "🚜", Services: "🛠️", Other: "📦",
};

export const UNITS = ["kg", "g", "litre", "ml", "crate", "bag", "pack", "bundle", "head", "unit", "acre", "piece"];
