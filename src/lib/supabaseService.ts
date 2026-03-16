/**
 * Supabase Service Layer
 *
 * All data operations go through Supabase.
 * Expected SQL schema (run in Supabase SQL editor):
 *
 * -- profiles (auto-created by trigger on auth.users)
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
 *   values (new.id, new.raw_user_meta_data->>'full_name', new.email, new.raw_user_meta_data->>'avatar_url');
 *   return new;
 * end;
 * $$ language plpgsql security definer;
 * create trigger on_auth_user_created after insert on auth.users
 *   for each row execute function handle_new_user();
 *
 * -- posts
 * create table if not exists posts (
 *   id uuid default gen_random_uuid() primary key,
 *   author_id uuid references profiles(id) on delete cascade,
 *   content text not null, image_url text, tag text,
 *   likes_count int default 0, comments_count int default 0,
 *   is_reported boolean default false,
 *   created_at timestamptz default now()
 * );
 *
 * -- post_reactions
 * create table if not exists post_reactions (
 *   id uuid default gen_random_uuid() primary key,
 *   post_id uuid references posts(id) on delete cascade,
 *   user_id uuid references profiles(id) on delete cascade,
 *   reaction_type text not null,
 *   created_at timestamptz default now(),
 *   unique(post_id, user_id)
 * );
 *
 * -- comments
 * create table if not exists comments (
 *   id uuid default gen_random_uuid() primary key,
 *   post_id uuid references posts(id) on delete cascade,
 *   author_id uuid references profiles(id) on delete cascade,
 *   content text not null,
 *   created_at timestamptz default now()
 * );
 *
 * -- marketplace_listings
 * create table if not exists marketplace_listings (
 *   id uuid default gen_random_uuid() primary key,
 *   seller_id uuid references profiles(id) on delete cascade,
 *   title text not null, description text, price text,
 *   location text, category text, image_url text, phone text,
 *   is_approved boolean default true,
 *   created_at timestamptz default now()
 * );
 *
 * -- farm_activities
 * create table if not exists farm_activities (
 *   id uuid default gen_random_uuid() primary key,
 *   user_id uuid references profiles(id) on delete cascade,
 *   type text not null, name text not null,
 *   location text, size text, species text, start_date date,
 *   created_at timestamptz default now()
 * );
 *
 * -- farm_tasks
 * create table if not exists farm_tasks (
 *   id uuid default gen_random_uuid() primary key,
 *   activity_id uuid references farm_activities(id) on delete cascade,
 *   title text not null, due_date date, is_completed boolean default false, category text
 * );
 *
 * -- farm_records
 * create table if not exists farm_records (
 *   id uuid default gen_random_uuid() primary key,
 *   activity_id uuid references farm_activities(id) on delete cascade,
 *   type text, description text, date date, quantity text
 * );
 *
 * -- notifications
 * create table if not exists notifications (
 *   id uuid default gen_random_uuid() primary key,
 *   user_id uuid references profiles(id) on delete cascade,
 *   type text, title text, message text,
 *   is_read boolean default false, avatar_url text,
 *   created_at timestamptz default now()
 * );
 *
 * -- Enable RLS on all tables and add policies as needed
 */

import { supabase } from "@/services/supabaseClient"
import type {
  Post, Comment, MarketplaceListing, FarmActivity, FarmTask, FarmRecord, Notification, User
} from "@/lib/dataService"

// ─── Profiles ────────────────────────────────────────────────────────────────

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
  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
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

export async function fetchPosts(): Promise<Post[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(`*, author:profiles!author_id (full_name, avatar_url, location)`)
    .order("created_at", { ascending: false })
  if (error) { console.error("fetchPosts:", error.message); return [] }
  return (data || []).map(mapPost)
}

export async function createPost(payload: {
  author_id: string
  content: string
  tag: string
  image_url?: string
}): Promise<Post | null> {
  const { data, error } = await supabase
    .from("posts")
    .insert(payload)
    .select(`*, author:profiles!author_id (full_name, avatar_url, location)`)
    .single()
  if (error) { console.error("createPost:", error.message); return null }
  return mapPost(data)
}

export async function deletePost(id: string) {
  const { error } = await supabase.from("posts").delete().eq("id", id)
  if (error) throw error
}

function mapPost(row: Record<string, unknown>): Post {
  const author = row.author as Record<string, string> | null
  const name = author?.full_name || "Unknown"
  return {
    id: row.id as string,
    authorId: row.author_id as string,
    authorName: name,
    authorAvatar: author?.avatar_url || name.charAt(0).toUpperCase(),
    authorLocation: author?.location || "",
    text: row.content as string,
    imageUrl: (row.image_url as string) || undefined,
    tag: (row.tag as string) || "General",
    likes: (row.likes_count as number) || 0,
    comments: (row.comments_count as number) || 0,
    createdAt: row.created_at as string,
    reported: (row.is_reported as boolean) || false,
  }
}

// ─── Comments ────────────────────────────────────────────────────────────────

export async function fetchComments(postId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from("comments")
    .select(`*, author:profiles!author_id (full_name, avatar_url)`)
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
  if (error) { console.error("fetchComments:", error.message); return [] }
  return (data || []).map((row) => {
    const author = row.author as Record<string, string> | null
    const name = author?.full_name || "Unknown"
    return {
      id: row.id,
      postId: row.post_id,
      authorId: row.author_id,
      authorName: name,
      authorAvatar: author?.avatar_url || name.charAt(0).toUpperCase(),
      text: row.content,
      createdAt: row.created_at,
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
  await supabase.rpc("increment_comments_count", { post_id: payload.post_id }).catch(() => {
    supabase.from("posts").select("comments_count").eq("id", payload.post_id).single().then(({ data }) => {
      if (data) supabase.from("posts").update({ comments_count: (data.comments_count || 0) + 1 }).eq("id", payload.post_id)
    })
  })
}

// ─── Reactions ───────────────────────────────────────────────────────────────

export async function getUserReactionSB(postId: string, userId: string): Promise<"like" | "dislike" | null> {
  const { data } = await supabase
    .from("post_reactions")
    .select("reaction_type")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .single()
  return (data?.reaction_type as "like" | "dislike") || null
}

export async function toggleReactionSB(postId: string, userId: string, type: "like" | "dislike"): Promise<void> {
  const { data: existing } = await supabase
    .from("post_reactions")
    .select("id, reaction_type")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .single()

  const { data: post } = await supabase.from("posts").select("likes_count").eq("id", postId).single()
  const currentLikes = post?.likes_count || 0

  if (existing) {
    if (existing.reaction_type === type) {
      await supabase.from("post_reactions").delete().eq("id", existing.id)
      if (type === "like") {
        await supabase.from("posts").update({ likes_count: Math.max(0, currentLikes - 1) }).eq("id", postId)
      }
    } else {
      await supabase.from("post_reactions").update({ reaction_type: type }).eq("id", existing.id)
      if (type === "like") {
        await supabase.from("posts").update({ likes_count: currentLikes + 1 }).eq("id", postId)
      } else {
        await supabase.from("posts").update({ likes_count: Math.max(0, currentLikes - 1) }).eq("id", postId)
      }
    }
  } else {
    await supabase.from("post_reactions").insert({ post_id: postId, user_id: userId, reaction_type: type })
    if (type === "like") {
      await supabase.from("posts").update({ likes_count: currentLikes + 1 }).eq("id", postId)
    }
  }
}

// ─── Marketplace ─────────────────────────────────────────────────────────────

export async function fetchListings(): Promise<MarketplaceListing[]> {
  const { data, error } = await supabase
    .from("marketplace_listings")
    .select(`*, seller:profiles!seller_id (full_name)`)
    .order("created_at", { ascending: false })
  if (error) { console.error("fetchListings:", error.message); return [] }
  return (data || []).map((row) => ({
    id: row.id,
    sellerId: row.seller_id,
    sellerName: (row.seller as Record<string, string>)?.full_name || "Unknown",
    title: row.title,
    description: row.description || "",
    price: row.price || "",
    location: row.location || "",
    category: row.category || "Other",
    imageUrl: row.image_url || undefined,
    phone: row.phone || "",
    createdAt: row.created_at,
    approved: row.is_approved,
  }))
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

export async function deleteListing(id: string) {
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
  const { data, error } = await supabase
    .from("farm_activities")
    .insert(payload)
    .select("id")
    .single()
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

// ─── Notifications ───────────────────────────────────────────────────────────

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
