/**
 * Supabase Service Layer — all database operations
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * SQL SCHEMA — run in Supabase SQL Editor (Project > SQL Editor > New Query)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * -- 1. PROFILES (auto-created by trigger on auth.users insert)
 * create table if not exists profiles (
 *   id uuid references auth.users on delete cascade primary key,
 *   full_name text, email text, avatar_url text,
 *   location text, farming_types text[], farm_scale text,
 *   bio text, role text default 'farmer',
 *   is_suspended boolean default false,
 *   onboarding_completed boolean default false,
 *   created_at timestamptz default now()
 * );
 * create or replace function handle_new_user() returns trigger as $$
 * begin
 *   insert into profiles (id, full_name, email, avatar_url)
 *   values (new.id, new.raw_user_meta_data->>'full_name', new.email,
 *           new.raw_user_meta_data->>'avatar_url')
 *   on conflict (id) do nothing;
 *   return new;
 * end;
 * $$ language plpgsql security definer;
 * drop trigger if exists on_auth_user_created on auth.users;
 * create trigger on_auth_user_created after insert on auth.users
 *   for each row execute function handle_new_user();
 *
 * -- 2. COMMUNITIES
 * create table if not exists communities (
 *   id uuid default gen_random_uuid() primary key,
 *   name text not null,
 *   description text,
 *   emoji text default '🌱',
 *   creator_id uuid references profiles(id) on delete cascade,
 *   members_count int default 1,
 *   is_private boolean default false,
 *   created_at timestamptz default now()
 * );
 *
 * -- 3. COMMUNITY MEMBERS (join table)
 * create table if not exists community_members (
 *   id uuid default gen_random_uuid() primary key,
 *   community_id uuid references communities(id) on delete cascade,
 *   user_id uuid references profiles(id) on delete cascade,
 *   role text default 'member',
 *   joined_at timestamptz default now(),
 *   unique(community_id, user_id)
 * );
 *
 * -- 4. POSTS
 * create table if not exists posts (
 *   id uuid default gen_random_uuid() primary key,
 *   author_id uuid references profiles(id) on delete cascade,
 *   content text not null,
 *   image_url text,
 *   tag text,
 *   community_id uuid references communities(id) on delete set null,
 *   shared_from_id uuid references posts(id) on delete set null,
 *   shared_from_author_name text,
 *   shared_from_text text,
 *   likes_count int default 0,
 *   comments_count int default 0,
 *   is_reported boolean default false,
 *   created_at timestamptz default now()
 * );
 *
 * -- 5. POST REACTIONS (unique per user per post)
 * create table if not exists post_reactions (
 *   id uuid default gen_random_uuid() primary key,
 *   post_id uuid references posts(id) on delete cascade,
 *   user_id uuid references profiles(id) on delete cascade,
 *   reaction_type text not null,
 *   created_at timestamptz default now(),
 *   unique(post_id, user_id)
 * );
 *
 * -- 6. COMMENTS
 * create table if not exists comments (
 *   id uuid default gen_random_uuid() primary key,
 *   post_id uuid references posts(id) on delete cascade,
 *   author_id uuid references profiles(id) on delete cascade,
 *   content text not null,
 *   created_at timestamptz default now()
 * );
 *
 * -- 7. USER BLOCKS
 * create table if not exists user_blocks (
 *   id uuid default gen_random_uuid() primary key,
 *   blocker_id uuid references profiles(id) on delete cascade,
 *   blocked_id uuid references profiles(id) on delete cascade,
 *   created_at timestamptz default now(),
 *   unique(blocker_id, blocked_id)
 * );
 *
 * -- 8. MARKETPLACE LISTINGS
 * create table if not exists marketplace_listings (
 *   id uuid default gen_random_uuid() primary key,
 *   seller_id uuid references profiles(id) on delete cascade,
 *   title text not null, description text, price text,
 *   location text, category text, image_url text, phone text,
 *   is_approved boolean default true,
 *   created_at timestamptz default now()
 * );
 *
 * -- 9. FARM TABLES
 * create table if not exists farm_activities (
 *   id uuid default gen_random_uuid() primary key,
 *   user_id uuid references profiles(id) on delete cascade,
 *   type text not null, name text not null,
 *   location text, size text, species text, start_date date,
 *   created_at timestamptz default now()
 * );
 * create table if not exists farm_tasks (
 *   id uuid default gen_random_uuid() primary key,
 *   activity_id uuid references farm_activities(id) on delete cascade,
 *   title text not null, due_date date, is_completed boolean default false, category text
 * );
 * create table if not exists farm_records (
 *   id uuid default gen_random_uuid() primary key,
 *   activity_id uuid references farm_activities(id) on delete cascade,
 *   type text, description text, date date, quantity text
 * );
 *
 * -- 10. NOTIFICATIONS
 * create table if not exists notifications (
 *   id uuid default gen_random_uuid() primary key,
 *   user_id uuid references profiles(id) on delete cascade,
 *   type text, title text, message text,
 *   is_read boolean default false, avatar_url text,
 *   created_at timestamptz default now()
 * );
 *
 * -- Enable Row Level Security on all tables:
 * alter table profiles enable row level security;
 * alter table communities enable row level security;
 * alter table community_members enable row level security;
 * alter table posts enable row level security;
 * alter table post_reactions enable row level security;
 * alter table comments enable row level security;
 * alter table user_blocks enable row level security;
 * alter table marketplace_listings enable row level security;
 * alter table farm_activities enable row level security;
 * alter table farm_tasks enable row level security;
 * alter table farm_records enable row level security;
 * alter table notifications enable row level security;
 *
 * -- RLS Policies (allow public read for posts/communities, auth for writes):
 * create policy "Public read posts" on posts for select using (true);
 * create policy "Auth insert posts" on posts for insert with check (auth.uid() = author_id);
 * create policy "Own update posts" on posts for update using (auth.uid() = author_id);
 * create policy "Own delete posts" on posts for delete using (auth.uid() = author_id);
 * create policy "Public read profiles" on profiles for select using (true);
 * create policy "Own update profile" on profiles for update using (auth.uid() = id);
 * create policy "Public read communities" on communities for select using (true);
 * create policy "Auth create community" on communities for insert with check (auth.uid() = creator_id);
 * create policy "Admin update community" on communities for update using (auth.uid() = creator_id);
 * create policy "Admin delete community" on communities for delete using (auth.uid() = creator_id);
 * create policy "Public read members" on community_members for select using (true);
 * create policy "Auth join community" on community_members for insert with check (auth.uid() = user_id);
 * create policy "Auth leave community" on community_members for delete using (auth.uid() = user_id);
 * create policy "Public read comments" on comments for select using (true);
 * create policy "Auth insert comment" on comments for insert with check (auth.uid() = author_id);
 * create policy "Own delete comment" on comments for delete using (auth.uid() = author_id);
 * create policy "Auth reactions" on post_reactions for all using (auth.uid() = user_id);
 * create policy "Own blocks" on user_blocks for all using (auth.uid() = blocker_id);
 * create policy "Public read listings" on marketplace_listings for select using (true);
 * create policy "Auth insert listing" on marketplace_listings for insert with check (auth.uid() = seller_id);
 * create policy "Own delete listing" on marketplace_listings for delete using (auth.uid() = seller_id);
 * create policy "Own notifications" on notifications for all using (auth.uid() = user_id);
 * create policy "Own farm data" on farm_activities for all using (auth.uid() = user_id);
 * create policy "Own tasks" on farm_tasks for all using (
 *   activity_id in (select id from farm_activities where user_id = auth.uid())
 * );
 * create policy "Own records" on farm_records for all using (
 *   activity_id in (select id from farm_activities where user_id = auth.uid())
 * );
 */

import { supabase } from "@/services/supabaseClient"
import type {
  Post, Comment, MarketplaceListing, FarmActivity,
  FarmTask, FarmRecord, Notification, User, Community, CommunityMember
} from "@/lib/dataService"

// ─── Profile helpers ──────────────────────────────────────────────────────────

interface ProfileRow {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
  location: string | null
}

async function fetchProfilesBatch(userIds: string[]): Promise<Map<string, ProfileRow>> {
  const map = new Map<string, ProfileRow>()
  if (!userIds.length) return map
  const unique = [...new Set(userIds)]
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url, location")
    .in("id", unique)
  for (const row of data || []) map.set(row.id, row)
  return map
}

function profileDisplayName(row: ProfileRow | undefined): string {
  if (!row) return "Unknown"
  return row.full_name || row.email?.split("@")[0] || "User"
}

function profileAvatar(row: ProfileRow | undefined, name: string): string {
  return row?.avatar_url || name.charAt(0).toUpperCase()
}

// ─── Profiles ─────────────────────────────────────────────────────────────────

export async function fetchProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single()
  if (error || !data) return null
  return mapProfile(data)
}

export async function updateProfile(userId: string, updates: {
  full_name?: string
  location?: string
  farming_types?: string[]
  farm_scale?: string
  bio?: string
  onboarding_completed?: boolean
  avatar_url?: string
}) {
  const { error } = await supabase.from("profiles").update(updates).eq("id", userId)
  if (error) throw error
}

function mapProfile(row: Record<string, unknown>): User {
  const name = (row.full_name as string) || (row.email as string)?.split("@")[0] || "User"
  return {
    id: row.id as string,
    name,
    email: (row.email as string) || "",
    role: (row.role as User["role"]) || "farmer",
    location: (row.location as string) || "",
    avatar: (row.avatar_url as string) || name.charAt(0).toUpperCase(),
    farmingActivities: (row.farming_types as string[]) || [],
    bio: (row.bio as string) || "",
    followers: 0,
    following: 0,
    postsCount: 0,
    createdAt: (row.created_at as string) || new Date().toISOString(),
    suspended: (row.is_suspended as boolean) || false,
  }
}

// ─── Posts ────────────────────────────────────────────────────────────────────

export async function fetchPosts(options?: {
  communityId?: string
  blockedUserIds?: string[]
}): Promise<Post[]> {
  let query = supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100)

  if (options?.communityId) {
    query = query.eq("community_id", options.communityId)
  }
  if (options?.blockedUserIds?.length) {
    query = query.not("author_id", "in", `(${options.blockedUserIds.join(",")})`)
  }

  const { data, error } = await query
  if (error) { console.error("fetchPosts:", error.message); return [] }

  const rows = data || []
  const authorIds = rows.map((r) => r.author_id as string)
  const profiles = await fetchProfilesBatch(authorIds)

  return rows.map((row) => mapPost(row, profiles))
}

export async function createPost(payload: {
  author_id: string
  content: string
  tag: string
  image_url?: string
  community_id?: string
  shared_from_id?: string
  shared_from_author_name?: string
  shared_from_text?: string
}): Promise<Post | null> {
  const { data, error } = await supabase
    .from("posts")
    .insert(payload)
    .select("*")
    .single()
  if (error) { console.error("createPost:", error.message); return null }

  const profiles = await fetchProfilesBatch([data.author_id])
  return mapPost(data, profiles)
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await supabase.from("posts").delete().eq("id", id)
  if (error) throw error
}

export async function reportPost(id: string): Promise<void> {
  const { error } = await supabase.from("posts").update({ is_reported: true }).eq("id", id)
  if (error) throw error
}

export async function sharePost(post: Post, userId: string): Promise<Post | null> {
  return createPost({
    author_id: userId,
    content: "",
    tag: post.tag,
    shared_from_id: post.id,
    shared_from_author_name: post.authorName,
    shared_from_text: post.text,
  })
}

function mapPost(row: Record<string, unknown>, profiles: Map<string, ProfileRow>): Post {
  const authorId = row.author_id as string
  const profile = profiles.get(authorId)
  const name = profileDisplayName(profile)
  return {
    id: row.id as string,
    authorId,
    authorName: name,
    authorAvatar: profileAvatar(profile, name),
    authorLocation: (profile?.location as string) || "",
    text: (row.content as string) || "",
    imageUrl: (row.image_url as string) || undefined,
    tag: (row.tag as string) || "General",
    likes: (row.likes_count as number) || 0,
    comments: (row.comments_count as number) || 0,
    createdAt: row.created_at as string,
    reported: (row.is_reported as boolean) || false,
    communityId: (row.community_id as string) || undefined,
    sharedFromId: (row.shared_from_id as string) || undefined,
    sharedFromAuthorName: (row.shared_from_author_name as string) || undefined,
    sharedFromText: (row.shared_from_text as string) || undefined,
  }
}

// ─── Comments ────────────────────────────────────────────────────────────────

export async function fetchComments(postId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
  if (error) { console.error("fetchComments:", error.message); return [] }

  const rows = data || []
  const authorIds = rows.map((r) => r.author_id as string)
  const profiles = await fetchProfilesBatch(authorIds)

  return rows.map((row) => {
    const profile = profiles.get(row.author_id as string)
    const name = profileDisplayName(profile)
    return {
      id: row.id as string,
      postId: row.post_id as string,
      authorId: row.author_id as string,
      authorName: name,
      authorAvatar: profileAvatar(profile, name),
      text: row.content as string,
      createdAt: row.created_at as string,
      reported: false,
    }
  })
}

export async function createComment(payload: {
  post_id: string
  author_id: string
  content: string
}): Promise<void> {
  const { error } = await supabase.from("comments").insert(payload)
  if (error) throw error
  // Increment comments_count atomically
  const { data: post } = await supabase.from("posts").select("comments_count").eq("id", payload.post_id).single()
  if (post) {
    await supabase.from("posts").update({ comments_count: (post.comments_count || 0) + 1 }).eq("id", payload.post_id)
  }
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase.from("comments").delete().eq("id", id)
  if (error) throw error
}

// ─── Reactions ───────────────────────────────────────────────────────────────

export async function getUserReactionSB(postId: string, userId: string): Promise<"like" | "dislike" | null> {
  const { data } = await supabase
    .from("post_reactions")
    .select("reaction_type")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle()
  return (data?.reaction_type as "like" | "dislike") || null
}

export async function toggleReactionSB(postId: string, userId: string, type: "like" | "dislike"): Promise<{ newLikes: number; newReaction: "like" | "dislike" | null }> {
  const { data: existing } = await supabase
    .from("post_reactions")
    .select("id, reaction_type")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle()

  const { data: post } = await supabase.from("posts").select("likes_count").eq("id", postId).single()
  let currentLikes = post?.likes_count || 0
  let newReaction: "like" | "dislike" | null = type

  if (existing) {
    if (existing.reaction_type === type) {
      await supabase.from("post_reactions").delete().eq("id", existing.id)
      if (type === "like") currentLikes = Math.max(0, currentLikes - 1)
      newReaction = null
    } else {
      await supabase.from("post_reactions").update({ reaction_type: type }).eq("id", existing.id)
      if (type === "like") currentLikes += 1
      else currentLikes = Math.max(0, currentLikes - 1)
    }
  } else {
    await supabase.from("post_reactions").insert({ post_id: postId, user_id: userId, reaction_type: type })
    if (type === "like") currentLikes += 1
  }

  await supabase.from("posts").update({ likes_count: currentLikes }).eq("id", postId)
  return { newLikes: currentLikes, newReaction }
}

// ─── Communities ─────────────────────────────────────────────────────────────

export async function fetchCommunities(userId?: string): Promise<Community[]> {
  const { data, error } = await supabase
    .from("communities")
    .select("*")
    .order("members_count", { ascending: false })
  if (error) { console.error("fetchCommunities:", error.message); return [] }

  let membershipMap = new Map<string, "admin" | "member">()
  if (userId) {
    const { data: memberships } = await supabase
      .from("community_members")
      .select("community_id, role")
      .eq("user_id", userId)
    for (const m of memberships || []) {
      membershipMap.set(m.community_id, m.role as "admin" | "member")
    }
  }

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description || "",
    emoji: row.emoji || "🌱",
    creatorId: row.creator_id,
    membersCount: row.members_count || 1,
    isPrivate: row.is_private || false,
    createdAt: row.created_at,
    memberRole: membershipMap.get(row.id) || null,
  }))
}

export async function createCommunity(payload: {
  creator_id: string
  name: string
  description: string
  emoji: string
  is_private: boolean
}): Promise<Community | null> {
  const { data, error } = await supabase
    .from("communities")
    .insert(payload)
    .select("*")
    .single()
  if (error) { console.error("createCommunity:", error.message); return null }

  // Auto-join creator as admin
  await supabase.from("community_members").insert({
    community_id: data.id,
    user_id: payload.creator_id,
    role: "admin",
  })

  return {
    id: data.id,
    name: data.name,
    description: data.description || "",
    emoji: data.emoji || "🌱",
    creatorId: data.creator_id,
    membersCount: 1,
    isPrivate: data.is_private || false,
    createdAt: data.created_at,
    memberRole: "admin",
  }
}

export async function updateCommunity(id: string, updates: {
  name?: string
  description?: string
  emoji?: string
  is_private?: boolean
}): Promise<void> {
  const { error } = await supabase.from("communities").update(updates).eq("id", id)
  if (error) throw error
}

export async function deleteCommunity(id: string): Promise<void> {
  const { error } = await supabase.from("communities").delete().eq("id", id)
  if (error) throw error
}

export async function joinCommunity(communityId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("community_members").insert({
    community_id: communityId,
    user_id: userId,
    role: "member",
  })
  if (error && !error.message.includes("duplicate")) throw error
  // Increment members count
  const { data } = await supabase.from("communities").select("members_count").eq("id", communityId).single()
  if (data) await supabase.from("communities").update({ members_count: (data.members_count || 0) + 1 }).eq("id", communityId)
}

export async function leaveCommunity(communityId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("community_members").delete()
    .eq("community_id", communityId)
    .eq("user_id", userId)
  if (error) throw error
  const { data } = await supabase.from("communities").select("members_count").eq("id", communityId).single()
  if (data) await supabase.from("communities").update({ members_count: Math.max(0, (data.members_count || 1) - 1) }).eq("id", communityId)
}

export async function fetchCommunityMembers(communityId: string): Promise<CommunityMember[]> {
  const { data, error } = await supabase
    .from("community_members")
    .select("*")
    .eq("community_id", communityId)
    .order("joined_at", { ascending: true })
  if (error) { console.error("fetchCommunityMembers:", error.message); return [] }

  const rows = data || []
  const userIds = rows.map((r) => r.user_id as string)
  const profiles = await fetchProfilesBatch(userIds)

  return rows.map((row) => {
    const profile = profiles.get(row.user_id as string)
    const name = profileDisplayName(profile)
    return {
      id: row.id,
      communityId: row.community_id,
      userId: row.user_id,
      role: row.role as "admin" | "member",
      joinedAt: row.joined_at,
      profile: { name, avatar: profileAvatar(profile, name), location: profile?.location || "" },
    }
  })
}

export async function removeMemberFromCommunity(communityId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("community_members").delete()
    .eq("community_id", communityId)
    .eq("user_id", userId)
  if (error) throw error
  const { data } = await supabase.from("communities").select("members_count").eq("id", communityId).single()
  if (data) await supabase.from("communities").update({ members_count: Math.max(0, (data.members_count || 1) - 1) }).eq("id", communityId)
}

export async function promoteMember(communityId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("community_members")
    .update({ role: "admin" })
    .eq("community_id", communityId)
    .eq("user_id", userId)
  if (error) throw error
}

// ─── User Blocks ──────────────────────────────────────────────────────────────

export async function fetchBlockedUserIds(blockerId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocked_id")
    .eq("blocker_id", blockerId)
  if (error) return []
  return (data || []).map((r) => r.blocked_id as string)
}

export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase.from("user_blocks").insert({
    blocker_id: blockerId,
    blocked_id: blockedId,
  })
  if (error && !error.message.includes("duplicate")) throw error
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase.from("user_blocks")
    .delete()
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId)
  if (error) throw error
}

// ─── Marketplace ─────────────────────────────────────────────────────────────

export async function fetchListings(): Promise<MarketplaceListing[]> {
  const { data, error } = await supabase
    .from("marketplace_listings")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) { console.error("fetchListings:", error.message); return [] }

  const rows = data || []
  const sellerIds = rows.map((r) => r.seller_id as string)
  const profiles = await fetchProfilesBatch(sellerIds)

  return rows.map((row) => {
    const profile = profiles.get(row.seller_id as string)
    return {
      id: row.id,
      sellerId: row.seller_id,
      sellerName: profileDisplayName(profile),
      title: row.title,
      description: row.description || "",
      price: row.price || "",
      location: row.location || "",
      category: row.category || "Other",
      imageUrl: row.image_url || undefined,
      phone: row.phone || "",
      createdAt: row.created_at,
      approved: row.is_approved,
    }
  })
}

export async function createListing(payload: {
  seller_id: string
  title: string
  description: string
  price: string
  location: string
  category: string
  phone: string
  image_url?: string
}): Promise<void> {
  const { error } = await supabase.from("marketplace_listings").insert(payload)
  if (error) throw error
}

export async function deleteListing(id: string): Promise<void> {
  const { error } = await supabase.from("marketplace_listings").delete().eq("id", id)
  if (error) throw error
}

// ─── Farm Activities ─────────────────────────────────────────────────────────

export async function fetchFarmActivities(userId: string): Promise<FarmActivity[]> {
  const { data, error } = await supabase
    .from("farm_activities")
    .select(`*, tasks:farm_tasks(*), records:farm_records(*)`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
  if (error) { console.error("fetchFarmActivities:", error.message); return [] }
  return (data || []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    type: row.type as FarmActivity["type"],
    name: row.name,
    location: row.location || "",
    size: row.size || "",
    species: row.species || "",
    startDate: row.start_date || "",
    tasks: ((row.tasks as Record<string, unknown>[]) || []).map((t) => ({
      id: t.id as string,
      title: t.title as string,
      dueDate: (t.due_date as string) || "",
      completed: (t.is_completed as boolean) || false,
      category: (t.category as string) || "",
    })),
    records: ((row.records as Record<string, unknown>[]) || []).map((r) => ({
      id: r.id as string,
      type: (r.type as string) || "",
      description: (r.description as string) || "",
      date: (r.date as string) || "",
      quantity: (r.quantity as string) || undefined,
    })),
  }))
}

export async function createFarmActivity(payload: {
  user_id: string
  type: string
  name: string
  location?: string
  size?: string
  species?: string
  start_date?: string
}): Promise<string | null> {
  const { data, error } = await supabase.from("farm_activities").insert(payload).select("id").single()
  if (error) { console.error("createFarmActivity:", error.message); return null }
  return data?.id || null
}

export async function addFarmTask(payload: {
  activity_id: string
  title: string
  due_date?: string
  category?: string
}): Promise<void> {
  const { error } = await supabase.from("farm_tasks").insert(payload)
  if (error) throw error
}

export async function toggleFarmTask(taskId: string, completed: boolean): Promise<void> {
  const { error } = await supabase.from("farm_tasks").update({ is_completed: completed }).eq("id", taskId)
  if (error) throw error
}

export async function addFarmRecord(payload: {
  activity_id: string
  type: string
  description: string
  date?: string
  quantity?: string
}): Promise<void> {
  const { error } = await supabase.from("farm_records").insert(payload)
  if (error) throw error
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function fetchNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
  if (error) { console.error("fetchNotifications:", error.message); return [] }
  return (data || []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    type: row.type as Notification["type"],
    title: row.title || "",
    message: row.message || "",
    read: row.is_read || false,
    avatar: row.avatar_url || undefined,
    createdAt: row.created_at,
  }))
}

export async function markNotificationReadSB(id: string): Promise<void> {
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id)
  if (error) throw error
}

export async function markAllNotificationsReadSB(userId: string): Promise<void> {
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false)
  if (error) throw error
}

export async function createNotificationSB(payload: {
  user_id: string
  type: string
  title: string
  message: string
  avatar_url?: string
}): Promise<void> {
  const { error } = await supabase.from("notifications").insert(payload)
  if (error) console.error("createNotification:", error.message)
}
