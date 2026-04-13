/**
 * Data Service Layer — types + localStorage fallbacks
 * All Supabase operations live in supabaseService.ts
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role: "farmer" | "business" | "expert" | "general" | "admin";
  location: string;
  avatar: string;
  farmingActivities: string[];
  bio: string;
  followers: number;
  following: number;
  postsCount: number;
  createdAt: string;
  suspended: boolean;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorLocation: string;
  text: string;
  imageUrl?: string;
  tag: string;
  likes: number;
  comments: number;
  createdAt: string;
  reported: boolean;
  communityId?: string;
  communityName?: string;
  sharedFromId?: string;
  sharedFromAuthorName?: string;
  sharedFromText?: string;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  text: string;
  createdAt: string;
  reported: boolean;
}

export interface Reaction {
  id: string;
  postId: string;
  userId: string;
  type: "like" | "dislike";
}

export interface Community {
  id: string;
  name: string;
  description: string;
  emoji: string;
  creatorId: string;
  membersCount: number;
  isPrivate: boolean;
  createdAt: string;
  memberRole?: "admin" | "member" | null;
}

export interface CommunityMember {
  id: string;
  communityId: string;
  userId: string;
  role: "admin" | "member";
  joinedAt: string;
  profile?: {
    name: string;
    avatar: string;
    location: string;
  };
}

export interface UserBlock {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: string;
}

export interface MarketplaceListing {
  id: string;
  sellerId: string;
  sellerName: string;
  title: string;
  description: string;
  price: string;
  location: string;
  category: string;
  imageUrl?: string;
  phone: string;
  createdAt: string;
  approved: boolean;
}

export interface Expert {
  id: string;
  userId: string;
  name: string;
  specialization: string;
  location: string;
  rating: number;
  reviews: number;
  experience: string;
  services: string;
  phone: string;
  avatar: string;
  approved: boolean;
}

export interface Alert {
  id: string;
  type: "pest" | "disease" | "weather" | "advisory";
  title: string;
  text: string;
  severity: "high" | "medium" | "low";
  region: string;
  createdAt: string;
  active: boolean;
}

export interface Article {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  content: string;
  tag: string;
  readTime: string;
  published: boolean;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: "like" | "comment" | "follow" | "marketplace" | "alert";
  title: string;
  message: string;
  read: boolean;
  avatar?: string;
  createdAt: string;
}

export interface CommunityGroup {
  id: string;
  name: string;
  emoji: string;
  members: number;
  postsPerWeek: number;
  description: string;
}

export interface FarmActivity {
  id: string;
  userId: string;
  type: "crop" | "livestock" | "poultry" | "aquaculture" | "beekeeping";
  name: string;
  location: string;
  size: string;
  species: string;
  startDate: string;
  tasks: FarmTask[];
  records: FarmRecord[];
}

export interface FarmTask {
  id: string;
  title: string;
  dueDate: string;
  completed: boolean;
  category: string;
}

export interface FarmRecord {
  id: string;
  type: string;
  description: string;
  date: string;
  quantity?: string;
}

// ─── Storage Helpers ─────────────────────────────────────────────────────────

function getStore<T>(key: string): T[] {
  try {
    const data = localStorage.getItem(`harvest_${key}`);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function setStore<T>(key: string, data: T[]) {
  localStorage.setItem(`harvest_${key}`, JSON.stringify(data));
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export function getCurrentUser(): User | null {
  try {
    const data = localStorage.getItem("harvest_current_user");
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: User | null) {
  if (user) {
    localStorage.setItem("harvest_current_user", JSON.stringify(user));
  } else {
    localStorage.removeItem("harvest_current_user");
  }
}

export function isAdmin(): boolean {
  return getCurrentUser()?.role === "admin";
}

export function isLoggedIn(): boolean {
  return getCurrentUser() !== null;
}

export function adminLogin(email: string, password: string): { success: boolean; error?: string } {
  const users = getStore<User>("users");
  const admin = users.find((u) => u.email === email && u.role === "admin");
  if (admin) { setCurrentUser(admin); return { success: true }; }
  return { success: false, error: "Invalid admin credentials" };
}

// ─── Posts (localStorage fallback) ───────────────────────────────────────────

export function getPosts(): Post[] {
  return getStore<Post>("posts").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createPost(post: Omit<Post, "id" | "createdAt" | "likes" | "comments" | "reported">): Post {
  const newPost: Post = { ...post, id: generateId(), createdAt: new Date().toISOString(), likes: 0, comments: 0, reported: false };
  const posts = getStore<Post>("posts");
  posts.push(newPost);
  setStore("posts", posts);
  return newPost;
}

export function deletePost(id: string) {
  setStore("posts", getStore<Post>("posts").filter((p) => p.id !== id));
}

// ─── Comments ────────────────────────────────────────────────────────────────

export function getComments(postId: string): Comment[] {
  return getStore<Comment>("comments").filter((c) => c.postId === postId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function createComment(comment: Omit<Comment, "id" | "createdAt" | "reported">): Comment {
  const newComment: Comment = { ...comment, id: generateId(), createdAt: new Date().toISOString(), reported: false };
  const comments = getStore<Comment>("comments");
  comments.push(newComment);
  setStore("comments", comments);
  const posts = getStore<Post>("posts");
  const postIdx = posts.findIndex((p) => p.id === comment.postId);
  if (postIdx !== -1) { posts[postIdx].comments = (posts[postIdx].comments || 0) + 1; setStore("posts", posts); }
  return newComment;
}

// ─── Reactions ───────────────────────────────────────────────────────────────

export function getUserReaction(postId: string, userId: string): "like" | "dislike" | null {
  return getStore<Reaction>("reactions").find((r) => r.postId === postId && r.userId === userId)?.type ?? null;
}

export function toggleReaction(postId: string, userId: string, type: "like" | "dislike") {
  const reactions = getStore<Reaction>("reactions");
  const existing = reactions.findIndex((r) => r.postId === postId && r.userId === userId);
  const posts = getStore<Post>("posts");
  const postIdx = posts.findIndex((p) => p.id === postId);
  if (existing !== -1) {
    const prev = reactions[existing].type;
    if (prev === type) {
      reactions.splice(existing, 1);
      if (postIdx !== -1 && type === "like") posts[postIdx].likes = Math.max(0, (posts[postIdx].likes || 0) - 1);
    } else {
      reactions[existing].type = type;
      if (postIdx !== -1) {
        if (type === "like") posts[postIdx].likes = (posts[postIdx].likes || 0) + 1;
        else posts[postIdx].likes = Math.max(0, (posts[postIdx].likes || 0) - 1);
      }
    }
  } else {
    reactions.push({ id: generateId(), postId, userId, type });
    if (postIdx !== -1 && type === "like") posts[postIdx].likes = (posts[postIdx].likes || 0) + 1;
  }
  setStore("reactions", reactions);
  setStore("posts", posts);
}

// ─── Notifications ───────────────────────────────────────────────────────────

export function createNotification(notification: Omit<Notification, "id" | "createdAt" | "read">): Notification {
  const n: Notification = { ...notification, id: generateId(), createdAt: new Date().toISOString(), read: false };
  const all = getStore<Notification>("notifications");
  all.push(n);
  setStore("notifications", all);
  return n;
}

export function getNotifications(userId?: string): Notification[] {
  const all = getStore<Notification>("notifications");
  return (userId ? all.filter((n) => n.userId === userId) : all).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function markNotificationRead(id: string) {
  setStore("notifications", getStore<Notification>("notifications").map((n) => n.id === id ? { ...n, read: true } : n));
}

export function markAllNotificationsRead(userId: string) {
  setStore("notifications", getStore<Notification>("notifications").map((n) => n.userId === userId ? { ...n, read: true } : n));
}

// ─── Marketplace ─────────────────────────────────────────────────────────────

export function getListings(): MarketplaceListing[] {
  return getStore<MarketplaceListing>("listings").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createListing(listing: Omit<MarketplaceListing, "id" | "createdAt" | "approved">): MarketplaceListing {
  const newListing: MarketplaceListing = { ...listing, id: generateId(), createdAt: new Date().toISOString(), approved: true };
  const listings = getStore<MarketplaceListing>("listings");
  listings.push(newListing);
  setStore("listings", listings);
  return newListing;
}

export function deleteListing(id: string) {
  setStore("listings", getStore<MarketplaceListing>("listings").filter((l) => l.id !== id));
}

export function updateListing(id: string, updates: Partial<MarketplaceListing>) {
  setStore("listings", getStore<MarketplaceListing>("listings").map((l) => l.id === id ? { ...l, ...updates } : l));
}

// ─── Experts ─────────────────────────────────────────────────────────────────

export function getExperts(): Expert[] { return getStore<Expert>("experts"); }
export function createExpert(expert: Omit<Expert, "id" | "approved">): Expert {
  const newExpert: Expert = { ...expert, id: generateId(), approved: false };
  const experts = getStore<Expert>("experts"); experts.push(newExpert); setStore("experts", experts); return newExpert;
}
export function updateExpert(id: string, updates: Partial<Expert>) {
  setStore("experts", getStore<Expert>("experts").map((e) => e.id === id ? { ...e, ...updates } : e));
}
export function deleteExpert(id: string) { setStore("experts", getStore<Expert>("experts").filter((e) => e.id !== id)); }

// ─── Alerts ──────────────────────────────────────────────────────────────────

export function getAlerts(): Alert[] {
  return getStore<Alert>("alerts").filter((a) => a.active).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function getAllAlerts(): Alert[] {
  return getStore<Alert>("alerts").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function createAlert(alert: Omit<Alert, "id" | "createdAt" | "active">): Alert {
  const newAlert: Alert = { ...alert, id: generateId(), createdAt: new Date().toISOString(), active: true };
  const alerts = getStore<Alert>("alerts"); alerts.push(newAlert); setStore("alerts", alerts); return newAlert;
}
export function updateAlert(id: string, updates: Partial<Alert>) {
  setStore("alerts", getStore<Alert>("alerts").map((a) => a.id === id ? { ...a, ...updates } : a));
}
export function deleteAlert(id: string) { setStore("alerts", getStore<Alert>("alerts").filter((a) => a.id !== id)); }

// ─── Articles ────────────────────────────────────────────────────────────────

export function getArticles(): Article[] {
  return getStore<Article>("articles").filter((a) => a.published).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function getAllArticles(): Article[] {
  return getStore<Article>("articles").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function createArticle(article: Omit<Article, "id" | "createdAt">): Article {
  const newArticle: Article = { ...article, id: generateId(), createdAt: new Date().toISOString() };
  const articles = getStore<Article>("articles"); articles.push(newArticle); setStore("articles", articles); return newArticle;
}
export function updateArticle(id: string, updates: Partial<Article>) {
  setStore("articles", getStore<Article>("articles").map((a) => a.id === id ? { ...a, ...updates } : a));
}
export function deleteArticle(id: string) { setStore("articles", getStore<Article>("articles").filter((a) => a.id !== id)); }

// ─── Users (Admin) ───────────────────────────────────────────────────────────

export function getUsers(): User[] { return getStore<User>("users"); }
export function updateUser(id: string, updates: Partial<User>) {
  const users = getStore<User>("users");
  setStore("users", users.map((u) => u.id === id ? { ...u, ...updates } : u));
  const current = getCurrentUser();
  if (current?.id === id) setCurrentUser({ ...current, ...updates });
}
export function deleteUser(id: string) {
  setStore("users", getStore<User>("users").filter((u) => u.id !== id));
  const current = getCurrentUser();
  if (current?.id === id) setCurrentUser(null);
}
export function createUser(user: Omit<User, "id" | "createdAt" | "suspended">): User {
  const newUser: User = { ...user, id: generateId(), createdAt: new Date().toISOString(), suspended: false };
  const users = getStore<User>("users"); users.push(newUser); setStore("users", users); return newUser;
}

// ─── Groups ──────────────────────────────────────────────────────────────────

export function getGroups(): CommunityGroup[] { return getStore<CommunityGroup>("groups"); }

// ─── Farm Activities ─────────────────────────────────────────────────────────

export function getFarmActivities(userId?: string): FarmActivity[] {
  const all = getStore<FarmActivity>("farm_activities");
  return userId ? all.filter((a) => a.userId === userId) : all;
}
export function createFarmActivity(activity: Omit<FarmActivity, "id">): FarmActivity {
  const newActivity: FarmActivity = { ...activity, id: generateId() };
  const activities = getStore<FarmActivity>("farm_activities");
  activities.push(newActivity); setStore("farm_activities", activities); return newActivity;
}
export function updateFarmActivity(id: string, updates: Partial<FarmActivity>) {
  setStore("farm_activities", getStore<FarmActivity>("farm_activities").map((a) => a.id === id ? { ...a, ...updates } : a));
}

// ─── Platform Stats (Admin) ──────────────────────────────────────────────────

export function getPlatformStats() {
  return {
    totalUsers: getStore<User>("users").length,
    totalPosts: getStore<Post>("posts").length,
    totalListings: getStore<MarketplaceListing>("listings").length,
    totalExperts: getStore<Expert>("experts").length,
    totalAlerts: getStore<Alert>("alerts").filter((a) => a.active).length,
    totalArticles: getStore<Article>("articles").length,
    reportedPosts: getStore<Post>("posts").filter((p) => p.reported).length,
    pendingExperts: getStore<Expert>("experts").filter((e) => !e.approved).length,
  };
}

// ─── Search ──────────────────────────────────────────────────────────────────

export interface SearchResult {
  id: string;
  category: "Farmers" | "Posts" | "Groups" | "Marketplace" | "Experts" | "Articles";
  title: string;
  subtitle: string;
  extra?: string;
}

export function searchPlatform(query: string): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const results: SearchResult[] = [];
  getUsers().forEach((u) => {
    if (u.name.toLowerCase().includes(q) || u.location.toLowerCase().includes(q))
      results.push({ id: u.id, category: "Farmers", title: u.name, subtitle: `${u.location} · ${u.farmingActivities.join(", ")}`, extra: `${u.followers} followers` });
  });
  getPosts().forEach((p) => {
    if (p.text.toLowerCase().includes(q) || p.authorName.toLowerCase().includes(q))
      results.push({ id: p.id, category: "Posts", title: p.text.slice(0, 60) + (p.text.length > 60 ? "..." : ""), subtitle: `Posted by ${p.authorName}` });
  });
  getGroups().forEach((g) => {
    if (g.name.toLowerCase().includes(q))
      results.push({ id: g.id, category: "Groups", title: g.name, subtitle: `${g.members.toLocaleString()} members` });
  });
  getListings().forEach((l) => {
    if (l.title.toLowerCase().includes(q) || l.category.toLowerCase().includes(q))
      results.push({ id: l.id, category: "Marketplace", title: l.title, subtitle: `${l.price} · ${l.location}` });
  });
  getExperts().filter((e) => e.approved).forEach((e) => {
    if (e.name.toLowerCase().includes(q) || e.specialization.toLowerCase().includes(q))
      results.push({ id: e.id, category: "Experts", title: e.name, subtitle: `${e.specialization} · ${e.location}` });
  });
  getArticles().forEach((a) => {
    if (a.title.toLowerCase().includes(q) || a.tag.toLowerCase().includes(q))
      results.push({ id: a.id, category: "Articles", title: a.title, subtitle: `${a.readTime} read` });
  });
  return results;
}

// ─── Initialize ───────────────────────────────────────────────────────────────

export function initializeApp() {
  // No hardcoded seed data — all content comes from Supabase
}
