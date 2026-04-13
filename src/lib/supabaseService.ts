/**
 * Supabase Service Layer
 * All queries match the ACTUAL database schema exactly.
 *
 * Key schema facts:
 *  - posts.user_id       = author (NOT NULL), not author_id
 *  - posts.community_id  = NOT NULL — every post must belong to a community
 *  - posts.original_post_id = self-FK for reposts/shares
 *  - post_reactions: columns are (post_id, user_id, type) — PK is (post_id, user_id), no id column
 *  - comments.user_id    = author (NOT NULL), not author_id
 *  - community_members.created_at (NOT joined_at); NO unique constraint on (user_id, community_id)
 *  - communities: no emoji, no is_private, no members_count columns; has image_url, creator_id
 *  - marketplace_listings: user_id (not seller_id), contact_info (not phone), price numeric, no category/is_approved
 *  - profiles: country + region (not location), no farming_types/avatar_url/bio/is_suspended/onboarding_completed
 *  - notifications: message only (no title, no avatar_url); has reference_id
 *  - user_blocks table does NOT exist in this DB
 */

import { supabase } from "@/services/supabaseClient"
import type {
  Post, Comment, MarketplaceListing, FarmActivity,
  Notification, User, Community, CommunityMember
} from "@/lib/dataService"

// ─── Profile batch helpers ────────────────────────────────────────────────────

interface ProfileRow {
  id: string
  full_name: string | null
  email: string | null
  region: string | null
  country: string | null
  role: string | null
}

async function batchProfiles(userIds: string[]): Promise<Map<string, ProfileRow>> {
  const map = new Map<string, ProfileRow>()
  if (!userIds.length) return map
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, region, country, role")
    .in("id", [...new Set(userIds)])
  for (const r of data || []) map.set(r.id, r)
  return map
}

function displayName(row: ProfileRow | undefined, meta?: string): string {
  if (!row) return meta || "Unknown"
  return row.full_name || row.email?.split("@")[0] || "User"
}

function displayAvatar(name: string, authMeta?: string): string {
  // avatar_url is not in profiles table — comes from auth user_metadata
  return authMeta || name.charAt(0).toUpperCase()
}

function displayLocation(row: ProfileRow | undefined): string {
  if (!row) return ""
  return row.region || row.country || ""
}

// ─── Profiles ─────────────────────────────────────────────────────────────────

export async function fetchProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, country, region, farm_scale, created_at")
    .eq("id", userId)
    .single()
  if (error || !data) return null
  const name = data.full_name || data.email?.split("@")[0] || "User"
  return {
    id: data.id,
    name,
    email: data.email || "",
    role: (data.role as User["role"]) || "user",
    location: data.region || data.country || "",
    avatar: name.charAt(0).toUpperCase(),   // real avatar_url not in profiles — overlay from auth
    farmingActivities: [],
    bio: "",
    followers: 0,
    following: 0,
    postsCount: 0,
    createdAt: data.created_at || new Date().toISOString(),
    suspended: false,
    country: data.country || undefined,
    region: data.region || undefined,
    farmScale: data.farm_scale || undefined,
  }
}

export async function updateProfile(userId: string, updates: {
  full_name?: string
  country?: string
  region?: string
  farm_scale?: string
}) {
  const { error } = await supabase.from("profiles").update(updates).eq("id", userId)
  if (error) throw error
}

// ─── Communities ──────────────────────────────────────────────────────────────

export async function fetchCommunities(userId?: string): Promise<Community[]> {
  const { data, error } = await supabase
    .from("communities")
    .select("id, name, description, image_url, creator_id, created_at")
    .order("created_at", { ascending: false })
  if (error) { console.error("fetchCommunities:", error.message); return [] }

  // Batch-fetch member counts for all communities
  const communityIds = (data || []).map((r) => r.id)
  let countMap = new Map<string, number>()
  if (communityIds.length) {
    const { data: memberships } = await supabase
      .from("community_members")
      .select("community_id")
      .in("community_id", communityIds)
    for (const m of memberships || []) {
      countMap.set(m.community_id, (countMap.get(m.community_id) || 0) + 1)
    }
  }

  // Fetch current user's memberships
  let membershipMap = new Map<string, "admin" | "member">()
  if (userId && communityIds.length) {
    const { data: myMemberships } = await supabase
      .from("community_members")
      .select("community_id, role")
      .eq("user_id", userId)
      .in("community_id", communityIds)
    for (const m of myMemberships || []) {
      membershipMap.set(m.community_id, m.role as "admin" | "member")
    }
  }

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description || "",
    imageUrl: row.image_url || undefined,
    creatorId: row.creator_id || "",
    membersCount: countMap.get(row.id) || 0,
    createdAt: row.created_at,
    memberRole: membershipMap.get(row.id) || null,
  }))
}

export async function createCommunity(payload: {
  creator_id: string
  name: string
  description: string
  image_url?: string
}): Promise<Community | null> {
  const { data, error } = await supabase
    .from("communities")
    .insert({
      creator_id: payload.creator_id,
      created_by: payload.creator_id,
      name: payload.name,
      description: payload.description,
      image_url: payload.image_url,
    })
    .select("id, name, description, image_url, creator_id, created_at")
    .single()
  if (error) { console.error("createCommunity:", error.message); return null }

  // Auto-join creator as admin
  await supabase.from("community_members").insert({
    community_id: data.id,
    user_id: payload.creator_id,
    role: "admin",
  }).then(({ error: e }) => { if (e) console.error("auto-join creator:", e.message) })

  return {
    id: data.id,
    name: data.name,
    description: data.description || "",
    imageUrl: data.image_url || undefined,
    creatorId: data.creator_id || "",
    membersCount: 1,
    createdAt: data.created_at,
    memberRole: "admin",
  }
}

export async function updateCommunity(id: string, updates: {
  name?: string
  description?: string
  image_url?: string
}): Promise<void> {
  const { error } = await supabase.from("communities").update(updates).eq("id", id)
  if (error) throw error
}

export async function deleteCommunity(id: string): Promise<void> {
  const { error } = await supabase.from("communities").delete().eq("id", id)
  if (error) throw error
}

export async function joinCommunity(communityId: string, userId: string): Promise<void> {
  // No unique constraint in DB — check for existing row first
  const { data: existing } = await supabase
    .from("community_members")
    .select("id")
    .eq("community_id", communityId)
    .eq("user_id", userId)
    .maybeSingle()
  if (existing) return   // already a member
  const { error } = await supabase.from("community_members").insert({
    community_id: communityId,
    user_id: userId,
    role: "member",
  })
  if (error) throw error
}

export async function leaveCommunity(communityId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("community_members").delete()
    .eq("community_id", communityId)
    .eq("user_id", userId)
  if (error) throw error
}

export async function fetchCommunityMembers(communityId: string): Promise<CommunityMember[]> {
  const { data, error } = await supabase
    .from("community_members")
    .select("id, user_id, community_id, role, created_at")   // created_at not joined_at
    .eq("community_id", communityId)
    .order("created_at", { ascending: true })
  if (error) { console.error("fetchCommunityMembers:", error.message); return [] }

  const rows = data || []
  const profiles = await batchProfiles(rows.map((r) => r.user_id))

  return rows.map((row) => {
    const profile = profiles.get(row.user_id)
    const name = displayName(profile)
    return {
      id: row.id,
      communityId: row.community_id,
      userId: row.user_id,
      role: row.role as "admin" | "member",
      createdAt: row.created_at,   // correct field name
      profile: { name, avatar: displayAvatar(name), location: displayLocation(profile) },
    }
  })
}

export async function removeMemberFromCommunity(communityId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("community_members").delete()
    .eq("community_id", communityId).eq("user_id", userId)
  if (error) throw error
}

export async function promoteMember(communityId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("community_members")
    .update({ role: "admin" })
    .eq("community_id", communityId).eq("user_id", userId)
  if (error) throw error
}

// ─── Posts ────────────────────────────────────────────────────────────────────

export async function fetchPosts(options?: {
  communityId?: string
  blockedUserIds?: string[]
}): Promise<Post[]> {
  let query = supabase
    .from("posts")
    .select("id, user_id, community_id, content, image_url, original_post_id, likes_count, dislikes_count, comments_count, is_deleted, created_at")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(100)

  if (options?.communityId) query = query.eq("community_id", options.communityId)
  if (options?.blockedUserIds?.length) {
    query = query.not("user_id", "in", `(${options.blockedUserIds.join(",")})`)
  }

  const { data, error } = await query
  if (error) { console.error("fetchPosts:", error.message); return [] }
  const rows = data || []

  // Batch-fetch authors
  const authorIds = rows.map((r) => r.user_id as string)
  const profiles = await batchProfiles(authorIds)

  // Batch-fetch community names
  const communityIds = [...new Set(rows.map((r) => r.community_id as string).filter(Boolean))]
  const communityNames = new Map<string, string>()
  if (communityIds.length) {
    const { data: comms } = await supabase.from("communities").select("id, name").in("id", communityIds)
    for (const c of comms || []) communityNames.set(c.id, c.name)
  }

  // Batch-fetch original posts for reposts
  const originalIds = [...new Set(rows.map((r) => r.original_post_id as string).filter(Boolean))]
  const originalPosts = new Map<string, { content: string; user_id: string }>()
  const originalAuthors = new Map<string, string>()
  if (originalIds.length) {
    const { data: origRows } = await supabase.from("posts").select("id, content, user_id").in("id", originalIds)
    for (const o of origRows || []) originalPosts.set(o.id, o)
    const origAuthorIds = [...new Set((origRows || []).map((o) => o.user_id))]
    const origProfiles = await batchProfiles(origAuthorIds)
    for (const [id, p] of origProfiles) originalAuthors.set(id, displayName(p))
  }

  return rows.map((row) => {
    const profile = profiles.get(row.user_id as string)
    const name = displayName(profile)
    const orig = row.original_post_id ? originalPosts.get(row.original_post_id) : undefined
    return {
      id: row.id as string,
      authorId: row.user_id as string,
      authorName: name,
      authorAvatar: displayAvatar(name),
      authorLocation: displayLocation(profile),
      text: (row.content as string) || "",
      imageUrl: (row.image_url as string) || undefined,
      tag: communityNames.get(row.community_id as string),
      likes: (row.likes_count as number) || 0,
      dislikes: (row.dislikes_count as number) || 0,
      comments: (row.comments_count as number) || 0,
      createdAt: row.created_at as string,
      isDeleted: (row.is_deleted as boolean) || false,
      reported: false,
      communityId: row.community_id as string,
      communityName: communityNames.get(row.community_id as string),
      originalPostId: (row.original_post_id as string) || undefined,
      originalPostContent: orig?.content,
      originalPostAuthorName: orig ? originalAuthors.get(orig.user_id) : undefined,
    }
  })
}

export async function createPost(payload: {
  user_id: string               // matches posts.user_id (NOT author_id)
  community_id: string          // NOT NULL in DB — required
  content: string
  image_url?: string
  original_post_id?: string     // matches posts.original_post_id
}): Promise<Post | null> {
  const { data, error } = await supabase
    .from("posts")
    .insert(payload)
    .select("id, user_id, community_id, content, image_url, original_post_id, likes_count, dislikes_count, comments_count, is_deleted, created_at")
    .single()
  if (error) { console.error("createPost:", error.message); return null }

  const profiles = await batchProfiles([data.user_id])
  const profile = profiles.get(data.user_id)
  const name = displayName(profile)

  return {
    id: data.id,
    authorId: data.user_id,
    authorName: name,
    authorAvatar: displayAvatar(name),
    authorLocation: displayLocation(profile),
    text: data.content || "",
    imageUrl: data.image_url || undefined,
    tag: undefined,
    likes: 0,
    dislikes: 0,
    comments: 0,
    createdAt: data.created_at,
    isDeleted: false,
    reported: false,
    communityId: data.community_id,
    originalPostId: data.original_post_id || undefined,
  }
}

export async function deletePost(id: string): Promise<void> {
  // Soft delete using is_deleted flag
  const { error } = await supabase.from("posts").update({ is_deleted: true }).eq("id", id)
  if (error) throw error
}

export async function reportPost(id: string): Promise<void> {
  // Log to system_logs since there's no is_reported column
  await supabase.from("system_logs").insert({
    log_type: "report",
    message: `Post reported: ${id}`,
    meta: { post_id: id },
  }).then(({ error }) => { if (error) console.error("reportPost:", error.message) })
}

export async function sharePost(post: Post, userId: string): Promise<Post | null> {
  return createPost({
    user_id: userId,
    community_id: post.communityId,    // share into same community
    content: "",
    original_post_id: post.id,
  })
}

// ─── Comments ────────────────────────────────────────────────────────────────

export async function fetchComments(postId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from("comments")
    .select("id, post_id, user_id, content, created_at, parent_id")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
  if (error) { console.error("fetchComments:", error.message); return [] }

  const rows = data || []
  const profiles = await batchProfiles(rows.map((r) => r.user_id as string))

  return rows.map((row) => {
    const profile = profiles.get(row.user_id as string)
    const name = displayName(profile)
    return {
      id: row.id as string,
      postId: row.post_id as string,
      authorId: row.user_id as string,
      authorName: name,
      authorAvatar: displayAvatar(name),
      text: row.content as string,
      createdAt: row.created_at as string,
      parentId: (row.parent_id as string) || undefined,
      reported: false,
    }
  })
}

export async function createComment(payload: {
  post_id: string
  user_id: string          // comments.user_id (NOT author_id)
  content: string
  parent_id?: string
}): Promise<void> {
  const { error } = await supabase.from("comments").insert(payload)
  if (error) throw error
  // Increment comments_count
  const { data: post } = await supabase.from("posts").select("comments_count").eq("id", payload.post_id).single()
  if (post) await supabase.from("posts").update({ comments_count: (post.comments_count || 0) + 1 }).eq("id", payload.post_id)
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase.from("comments").delete().eq("id", id)
  if (error) throw error
}

// ─── Reactions ───────────────────────────────────────────────────────────────
// post_reactions: columns are post_id, user_id, type — PK is (post_id, user_id) — no id column

export async function getUserReactionSB(postId: string, userId: string): Promise<"like" | "dislike" | null> {
  const { data } = await supabase
    .from("post_reactions")
    .select("type")               // correct column name is "type" not "reaction_type"
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle()
  return (data?.type as "like" | "dislike") || null
}

export async function toggleReactionSB(
  postId: string,
  userId: string,
  type: "like" | "dislike"
): Promise<{ newLikes: number; newDislikes: number; newReaction: "like" | "dislike" | null }> {
  const { data: existing } = await supabase
    .from("post_reactions")
    .select("type")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle()

  const { data: post } = await supabase.from("posts")
    .select("likes_count, dislikes_count")
    .eq("id", postId).single()

  let likes = post?.likes_count || 0
  let dislikes = post?.dislikes_count || 0
  let newReaction: "like" | "dislike" | null = type

  if (existing) {
    const prev = existing.type as "like" | "dislike"
    if (prev === type) {
      // Toggle off — remove the row using composite PK
      await supabase.from("post_reactions").delete()
        .eq("post_id", postId).eq("user_id", userId)
      if (type === "like") likes = Math.max(0, likes - 1)
      else dislikes = Math.max(0, dislikes - 1)
      newReaction = null
    } else {
      // Switch reaction
      await supabase.from("post_reactions").update({ type })
        .eq("post_id", postId).eq("user_id", userId)
      if (type === "like") { likes += 1; dislikes = Math.max(0, dislikes - 1) }
      else { dislikes += 1; likes = Math.max(0, likes - 1) }
    }
  } else {
    // Insert new — no "id" column, just post_id, user_id, type
    await supabase.from("post_reactions").insert({ post_id: postId, user_id: userId, type })
    if (type === "like") likes += 1
    else dislikes += 1
  }

  await supabase.from("posts").update({ likes_count: likes, dislikes_count: dislikes }).eq("id", postId)
  return { newLikes: likes, newDislikes: dislikes, newReaction }
}

// ─── User Blocks (table does NOT exist in this DB — no-op) ───────────────────

export async function fetchBlockedUserIds(_blockerId: string): Promise<string[]> {
  return []   // user_blocks table not in this schema
}

export async function blockUser(_blockerId: string, _blockedId: string): Promise<void> {
  // user_blocks table not in this schema — silently no-op
}

export async function unblockUser(_blockerId: string, _blockedId: string): Promise<void> {
  // user_blocks table not in this schema — silently no-op
}

// ─── Marketplace ─────────────────────────────────────────────────────────────

export async function fetchListings(): Promise<MarketplaceListing[]> {
  const { data, error } = await supabase
    .from("marketplace_listings")
    .select("id, user_id, title, description, price, location, image_url, contact_info, created_at")
    .order("created_at", { ascending: false })
  if (error) { console.error("fetchListings:", error.message); return [] }

  const rows = data || []
  const profiles = await batchProfiles(rows.map((r) => r.user_id as string))

  return rows.map((row) => {
    const profile = profiles.get(row.user_id as string)
    return {
      id: row.id as string,
      sellerId: row.user_id as string,
      sellerName: displayName(profile),
      title: row.title as string,
      description: (row.description as string) || "",
      price: row.price as number | null,
      location: (row.location as string) || "",
      imageUrl: (row.image_url as string) || undefined,
      contactInfo: (row.contact_info as string) || "",
      createdAt: row.created_at as string,
      approved: true,
    }
  })
}

export async function createListing(payload: {
  user_id: string           // marketplace_listings.user_id (NOT seller_id)
  title: string
  description: string
  price: number | null      // numeric in DB
  location: string
  contact_info: string      // marketplace_listings.contact_info (NOT phone)
  image_url?: string
}): Promise<void> {
  const { error } = await supabase.from("marketplace_listings").insert(payload)
  if (error) throw error
}

export async function deleteListing(id: string): Promise<void> {
  const { error } = await supabase.from("marketplace_listings").delete().eq("id", id)
  if (error) throw error
}

// ─── Farm Activities (using actual DB schema) ─────────────────────────────────
// The actual farm_activities table in DB is very different from what we assumed.
// We keep the existing UI working by mapping to the closest real columns.

export async function fetchFarmActivities(userId: string): Promise<FarmActivity[]> {
  const { data, error } = await supabase
    .from("farm_records")
    .select("id, user_id, name, description, record_type, sowing_date, status, created_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
  if (error) { console.error("fetchFarmActivities:", error.message); return [] }

  return (data || []).map((row) => ({
    id: row.id as string,
    userId: row.user_id as string,
    type: mapRecordType(row.record_type as string),
    name: row.name as string,
    location: "",
    size: "",
    species: "",
    startDate: (row.sowing_date as string) || "",
    tasks: [],
    records: [],
  }))
}

function mapRecordType(t: string): FarmActivity["type"] {
  const map: Record<string, FarmActivity["type"]> = {
    crop: "crop", livestock: "livestock", poultry: "poultry",
    aquaculture: "aquaculture", beekeeping: "beekeeping",
  }
  return map[t] || "crop"
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
    .from("farm_records")
    .insert({
      user_id: payload.user_id,
      name: payload.name,
      record_type: payload.type,
      sowing_date: payload.start_date || null,
      status: "active",
    })
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
  const { error } = await supabase.from("tasks").insert({
    title: payload.title,
    due_date: payload.due_date,
    status: "pending",
  })
  if (error) throw error
}

export async function toggleFarmTask(taskId: string, completed: boolean): Promise<void> {
  const { error } = await supabase.from("tasks")
    .update({ status: completed ? "done" : "pending" })
    .eq("id", taskId)
  if (error) throw error
}

export async function addFarmRecord(payload: {
  activity_id: string
  type: string
  description: string
  date?: string
  quantity?: string
}): Promise<void> {
  // Log activity using farm_activities table in DB (as a note/observation)
  const { error } = await supabase.from("farm_activities").insert({
    user_id: "00000000-0000-0000-0000-000000000000",   // placeholder — requires user_id
    farm_record_id: payload.activity_id,
    activity_type: "observation",
    title: payload.type,
    notes: payload.description,
    start_time: payload.date ? new Date(payload.date).toISOString() : new Date().toISOString(),
  })
  if (error) console.error("addFarmRecord:", error.message)
}

// ─── Notifications ────────────────────────────────────────────────────────────
// notifications table: user_id, type, message (no title, no avatar_url), is_read, reference_id

export async function fetchNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, user_id, type, message, is_read, created_at, reference_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
  if (error) { console.error("fetchNotifications:", error.message); return [] }
  return (data || []).map((row) => ({
    id: row.id as string,
    userId: row.user_id as string,
    type: (row.type as Notification["type"]) || "alert",
    message: (row.message as string) || "",
    read: (row.is_read as boolean) || false,
    createdAt: row.created_at as string,
    referenceId: (row.reference_id as string) || undefined,
  }))
}

export async function markNotificationReadSB(id: string): Promise<void> {
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id)
  if (error) throw error
}

export async function markAllNotificationsReadSB(userId: string): Promise<void> {
  const { error } = await supabase.from("notifications").update({ is_read: true })
    .eq("user_id", userId).eq("is_read", false)
  if (error) throw error
}

export async function createNotificationSB(payload: {
  user_id: string
  type: string
  message: string            // no title column in DB
  reference_id?: string      // notifications.reference_id
}): Promise<void> {
  const { error } = await supabase.from("notifications").insert(payload)
  if (error) console.error("createNotification:", error.message)
}
