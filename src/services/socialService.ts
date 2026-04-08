/**
 * Social Service
 *
 * Centralised Supabase data layer for all social interactions:
 *  – Posts (create, list, delete, share/repost)
 *  – Reactions (like / dislike toggle)
 *  – Comments (list, create, delete)
 *  – Communities (list, create, join, leave)
 *  – Media upload (Supabase Storage)
 *
 * No database logic lives in UI components.
 */

import { supabase } from "./supabaseClient";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SocialPost {
  id: string;
  userId: string;
  text: string;
  imageUrl?: string;
  videoUrl?: string;
  tag: string;
  communityId?: string;
  community?: { id: string; name: string };
  originalPostId?: string;
  originalPost?: SocialPost;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  createdAt: string;
  authorName: string;
  authorAvatar: string;
  authorLocation: string;
  userReaction: "like" | "dislike" | null;
}

export interface SocialComment {
  id: string;
  postId: string;
  userId: string;
  text: string;
  createdAt: string;
  authorName: string;
  authorAvatar: string;
}

export interface Community {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  creatorId: string;
  memberCount: number;
  createdAt: string;
  isMember: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizePost(row: any, userReaction: "like" | "dislike" | null = null): SocialPost {
  const p = row.profile ?? {};
  const initials = (p.full_name ?? "U").charAt(0).toUpperCase();
  return {
    id: row.id,
    userId: row.user_id,
    text: row.text ?? "",
    imageUrl: row.image_url ?? undefined,
    videoUrl: row.video_url ?? undefined,
    tag: row.tag ?? "Discussion",
    communityId: row.community_id ?? undefined,
    community: row.community ?? undefined,
    originalPostId: row.original_post_id ?? undefined,
    originalPost: row.original_post ? normalizePost(row.original_post) : undefined,
    likeCount: row.like_count ?? 0,
    dislikeCount: row.dislike_count ?? 0,
    commentCount: row.comment_count ?? 0,
    createdAt: row.created_at,
    authorName: p.full_name ?? "Unknown Farmer",
    authorAvatar: p.avatar_url || initials,
    authorLocation: p.location ?? "",
    userReaction,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeComment(row: any): SocialComment {
  const p = row.profile ?? {};
  return {
    id: row.id,
    postId: row.post_id,
    userId: row.user_id,
    text: row.text,
    createdAt: row.created_at,
    authorName: p.full_name ?? "Unknown Farmer",
    authorAvatar: p.avatar_url || (p.full_name ?? "U").charAt(0).toUpperCase(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeCommunity(row: any, isMember = false): Community {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    imageUrl: row.image_url ?? undefined,
    creatorId: row.creator_id,
    memberCount: row.member_count ?? 0,
    createdAt: row.created_at,
    isMember,
  };
}

const POST_SELECT = `
  *,
  profile:profiles!user_id ( full_name, avatar_url, location ),
  community:communities!community_id ( id, name ),
  original_post:posts!original_post_id (
    *,
    profile:profiles!user_id ( full_name, avatar_url, location )
  )
`;

// ─── Posts ────────────────────────────────────────────────────────────────────

export async function fetchPosts(options: {
  limit?: number;
  offset?: number;
  communityId?: string | null;
} = {}): Promise<SocialPost[]> {
  const { limit = 20, offset = 0, communityId } = options;

  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (communityId) {
    query = query.eq("community_id", communityId);
  }

  const { data: rows, error } = await query;
  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  // Fetch current user's reactions for these posts
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  const reactionMap = new Map<string, "like" | "dislike">();

  if (userId && rows.length > 0) {
    const { data: reactions } = await supabase
      .from("post_reactions")
      .select("post_id, type")
      .eq("user_id", userId)
      .in("post_id", rows.map((r) => r.id));

    reactions?.forEach((r) => reactionMap.set(r.post_id, r.type as "like" | "dislike"));
  }

  return rows.map((r) => normalizePost(r, reactionMap.get(r.id) ?? null));
}

export async function createPost(data: {
  text: string;
  imageUrl?: string;
  videoUrl?: string;
  tag?: string;
  communityId?: string | null;
}): Promise<SocialPost> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { data: row, error } = await supabase
    .from("posts")
    .insert({
      user_id: userId,
      text: data.text,
      image_url: data.imageUrl ?? null,
      video_url: data.videoUrl ?? null,
      tag: data.tag ?? "Discussion",
      community_id: data.communityId ?? null,
    })
    .select(POST_SELECT)
    .single();

  if (error) throw error;
  return normalizePost(row);
}

export async function deletePost(postId: string): Promise<void> {
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) throw error;
}

export async function sharePost(
  originalPostId: string,
  comment = ""
): Promise<SocialPost> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { data: row, error } = await supabase
    .from("posts")
    .insert({
      user_id: userId,
      text: comment,
      original_post_id: originalPostId,
      tag: "Discussion",
    })
    .select(POST_SELECT)
    .single();

  if (error) throw error;
  return normalizePost(row);
}

// ─── Reactions ────────────────────────────────────────────────────────────────

export async function toggleReaction(
  postId: string,
  type: "like" | "dislike",
  currentReaction: "like" | "dislike" | null
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  if (currentReaction === type) {
    // Same type → remove (toggle off)
    const { error } = await supabase
      .from("post_reactions")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);
    if (error) throw error;
  } else {
    // New or different type → upsert
    const { error } = await supabase
      .from("post_reactions")
      .upsert({ post_id: postId, user_id: userId, type });
    if (error) throw error;
  }
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export async function fetchComments(postId: string): Promise<SocialComment[]> {
  const { data, error } = await supabase
    .from("post_comments")
    .select("*, profile:profiles!user_id ( full_name, avatar_url )")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(normalizeComment);
}

export async function createComment(
  postId: string,
  text: string
): Promise<SocialComment> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("post_comments")
    .insert({ post_id: postId, user_id: userId, text })
    .select("*, profile:profiles!user_id ( full_name, avatar_url )")
    .single();

  if (error) throw error;
  return normalizeComment(data);
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.from("post_comments").delete().eq("id", commentId);
  if (error) throw error;
}

// ─── Communities ──────────────────────────────────────────────────────────────

export async function fetchCommunities(): Promise<Community[]> {
  const { data: rows, error } = await supabase
    .from("communities")
    .select("*")
    .order("member_count", { ascending: false });
  if (error) throw error;

  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  const memberSet = new Set<string>();

  if (userId && rows && rows.length > 0) {
    const { data: memberships } = await supabase
      .from("community_members")
      .select("community_id")
      .eq("user_id", userId)
      .in("community_id", rows.map((r) => r.id));
    memberships?.forEach((m) => memberSet.add(m.community_id));
  }

  return (rows ?? []).map((r) => normalizeCommunity(r, memberSet.has(r.id)));
}

export async function fetchCommunity(id: string): Promise<Community | null> {
  const { data: row, error } = await supabase
    .from("communities")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !row) return null;

  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  let isMember = false;

  if (userId) {
    const { data: m } = await supabase
      .from("community_members")
      .select("community_id")
      .eq("community_id", id)
      .eq("user_id", userId)
      .maybeSingle();
    isMember = !!m;
  }

  return normalizeCommunity(row, isMember);
}

export async function createCommunity(data: {
  name: string;
  description?: string;
  imageUrl?: string;
}): Promise<Community> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { data: row, error } = await supabase
    .from("communities")
    .insert({
      name: data.name,
      description: data.description ?? "",
      image_url: data.imageUrl ?? null,
      creator_id: userId,
    })
    .select()
    .single();

  if (error) throw error;

  // Creator is auto-member
  await supabase
    .from("community_members")
    .insert({ community_id: row.id, user_id: userId })
    .then(() => {});

  return normalizeCommunity(row, true);
}

export async function joinCommunity(communityId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("community_members")
    .insert({ community_id: communityId, user_id: userId });
  if (error) throw error;
}

export async function leaveCommunity(communityId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("community_members")
    .delete()
    .eq("community_id", communityId)
    .eq("user_id", userId);
  if (error) throw error;
}

// ─── Media upload ─────────────────────────────────────────────────────────────

export async function uploadMedia(file: File): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("post-media")
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from("post-media").getPublicUrl(path);
  return data.publicUrl;
}
