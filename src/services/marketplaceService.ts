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

// ─── Seed Data ─────────────────────────────────────────────────────────────────

function seedIfEmpty() {
  const existing = load<MarketplaceListing>(LISTINGS_KEY);
  if (existing.length > 0) return;

  const seeds: CreateListingInput[] = [
    {
      user_id: "seed-1", seller_name: "Wanjiku Farms", seller_avatar: "W", user_type: "business",
      title: "Fresh Organic Tomatoes - 50kg Crate", description: "Freshly harvested organic tomatoes from our Kiambu farm. Perfect for retailers and restaurants. Pesticide-free, Grade A quality.",
      image_urls: ["https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600"], price: 3500, unit: "crate",
      category: "Produce", location_name: "Kiambu, Kenya", latitude: -1.1714, longitude: 36.8356, availability: 20, phone: "+254 712 345 678",
    },
    {
      user_id: "seed-2", seller_name: "John Ochieng", user_type: "individual",
      title: "Grade A Friesian Heifer - 2 Years", description: "Well-bred Friesian heifer, vaccinated and dewormed. Producing 15L daily. Comes with health certificate.",
      image_urls: ["https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?w=600"], price: 85000, unit: "head",
      category: "Livestock", location_name: "Nakuru, Kenya", latitude: -0.3031, longitude: 36.0800, availability: 1, phone: "+254 798 765 432",
    },
    {
      user_id: "seed-3", seller_name: "AgroSupply Ltd", seller_avatar: "A", user_type: "business",
      title: "DAP Fertilizer 50kg Bags", description: "Genuine DAP fertilizer for planting season. Bulk discounts available for orders above 10 bags.",
      image_urls: ["https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600"], price: 4200, unit: "bag",
      category: "Fertilizer", location_name: "Eldoret, Kenya", latitude: 0.5143, longitude: 35.2698, availability: 200, phone: "+254 700 111 222", is_featured: true,
    },
    {
      user_id: "seed-4", seller_name: "Mama Njeri", user_type: "individual",
      title: "Certified Maize Seeds - DK 8031", description: "High-yield certified maize seeds suitable for highland areas. Government-approved variety for the current planting season.",
      image_urls: ["https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=600"], price: 450, unit: "kg",
      category: "Seeds", location_name: "Nyeri, Kenya", latitude: -0.4197, longitude: 36.9511, availability: 500,
    },
    {
      user_id: "seed-5", seller_name: "Kamau Machinery", seller_avatar: "K", user_type: "business",
      title: "Massey Ferguson 240 Tractor", description: "Well-maintained MF 240, 2019 model, low hours. Complete with plough and harrow attachments. Financing available.",
      image_urls: ["https://images.unsplash.com/photo-1530267981375-f0de937f5f13?w=600"], price: 1800000, unit: "unit",
      category: "Equipment", location_name: "Nairobi, Kenya", latitude: -1.2921, longitude: 36.8219, availability: 1, phone: "+254 722 333 444", is_featured: true,
    },
    {
      user_id: "seed-6", seller_name: "Grace Mwangi", user_type: "individual",
      title: "Fresh Avocados - Hass Variety", description: "Export-quality Hass avocados. Ready for harvest. Minimum order 100kg.",
      image_urls: ["https://images.unsplash.com/photo-1523049673857-eb18f1d80f67?w=600"], price: 120, unit: "kg",
      category: "Produce", location_name: "Murang'a, Kenya", latitude: -0.7210, longitude: 37.1526, availability: 2000,
    },
  ];

  const listings = seeds.map((s) => ({
    ...s,
    id: uid(),
    is_featured: s.is_featured ?? false,
    created_at: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
    updated_at: now(),
  }));
  save(LISTINGS_KEY, listings);
}

// ─── Listings CRUD ─────────────────────────────────────────────────────────────

export function getListings(filters?: ListingFilters): MarketplaceListing[] {
  seedIfEmpty();
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
