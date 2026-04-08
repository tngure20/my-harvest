import { useState, useEffect, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import { Users, Plus, LogIn, RefreshCw, TrendingUp, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  fetchPosts, fetchCommunities, joinCommunity, leaveCommunity,
  type SocialPost, type Community,
} from "@/services/socialService";
import PostCard from "@/components/community/PostCard";
import CreatePostSheet from "@/components/community/CreatePostSheet";
import CreateCommunitySheet from "@/components/community/CreateCommunitySheet";
import EmptyState from "@/components/ui/EmptyState";

const PAGE_SIZE = 15;

const CommunityCard = ({
  c, onJoin, onOpen,
}: {
  c: Community;
  onJoin: (id: string, isMember: boolean) => void;
  onOpen: (id: string) => void;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
    className="harvest-card cursor-pointer overflow-hidden flex-shrink-0 w-48"
    onClick={() => onOpen(c.id)}
  >
    {c.imageUrl && (
      <img src={c.imageUrl} alt={c.name} className="h-20 w-full object-cover bg-muted"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
    )}
    {!c.imageUrl && (
      <div className="h-20 w-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
        <Users className="h-8 w-8 text-primary/40" />
      </div>
    )}
    <div className="p-3">
      <p className="text-xs font-semibold text-foreground line-clamp-1">{c.name}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{c.memberCount} member{c.memberCount !== 1 ? "s" : ""}</p>
      <button
        onClick={(e) => { e.stopPropagation(); onJoin(c.id, c.isMember); }}
        className={`mt-2 w-full rounded-lg py-1.5 text-[11px] font-semibold transition-colors ${
          c.isMember
            ? "border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        }`}
      >
        {c.isMember ? "Leave" : "Join"}
      </button>
    </div>
  </motion.div>
);

const Community = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [filter, setFilter] = useState<"all" | "my-communities">("all");
  const [activeCommunityFilter, setActiveCommunityFilter] = useState<string | null>(null);

  const myCommunities = communities.filter(c => c.isMember);

  const load = useCallback(async (reset = false) => {
    if (reset) {
      setLoading(true);
      setPosts([]);
    } else {
      setLoadingMore(true);
    }

    try {
      const offset = reset ? 0 : posts.length;
      const [newPosts, comms] = await Promise.all([
        fetchPosts({ limit: PAGE_SIZE, offset, communityId: activeCommunityFilter }),
        reset ? fetchCommunities() : Promise.resolve(communities),
      ]);

      if (reset) setCommunities(comms);

      setPosts(prev => reset ? newPosts : [...prev, ...newPosts]);
      setHasMore(newPosts.length === PAGE_SIZE);
    } catch (err) {
      toast.error("Could not load posts. Check your connection.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeCommunityFilter, posts.length, communities]);

  useEffect(() => { load(true); }, [activeCommunityFilter]);

  const handleJoin = async (communityId: string, isMember: boolean) => {
    if (!isAuthenticated) { navigate("/login"); return; }
    try {
      if (isMember) {
        await leaveCommunity(communityId);
        toast.success("Left community.");
      } else {
        await joinCommunity(communityId);
        toast.success("Joined community!");
      }
      setCommunities(prev => prev.map(c =>
        c.id === communityId
          ? { ...c, isMember: !isMember, memberCount: isMember ? Math.max(0, c.memberCount - 1) : c.memberCount + 1 }
          : c
      ));
    } catch {
      toast.error(`Could not ${isMember ? "leave" : "join"} community.`);
    }
  };

  const handlePostCreated = (post: SocialPost) => {
    setPosts(prev => [post, ...prev]);
  };

  const handlePostDeleted = (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  const visiblePosts = filter === "my-communities" && myCommunities.length > 0
    ? posts.filter(p => p.communityId && myCommunities.some(c => c.id === p.communityId))
    : posts;

  const postsByCommunityFilter = activeCommunityFilter
    ? posts.filter(p => p.communityId === activeCommunityFilter)
    : posts;

  return (
    <AppLayout>
      <div className="px-4 py-4 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Community</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(true)}
              disabled={loading}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted disabled:opacity-40"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            {isAuthenticated ? (
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                <Plus className="h-4 w-4" /> Post
              </button>
            ) : (
              <button
                onClick={() => navigate("/login")}
                className="flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                <LogIn className="h-4 w-4" /> Sign in
              </button>
            )}
          </div>
        </div>

        {/* Communities horizontal scroll */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="harvest-section-title">Communities</h2>
            {isAuthenticated && (
              <button
                onClick={() => setShowCreateCommunity(true)}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Plus className="h-3 w-3" /> New
              </button>
            )}
          </div>

          {communities.length === 0 && !loading ? (
            <div className="harvest-card p-4 text-center">
              <p className="text-xs text-muted-foreground">No communities yet.</p>
              {isAuthenticated && (
                <button onClick={() => setShowCreateCommunity(true)} className="mt-2 text-xs font-medium text-primary">
                  Create the first one →
                </button>
              )}
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {communities.map(c => (
                <CommunityCard
                  key={c.id}
                  c={c}
                  onJoin={handleJoin}
                  onOpen={(id) => navigate(`/community/${id}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Feed header + filter */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="harvest-section-title flex-1">Feed</h2>
            {myCommunities.length > 0 && (
              <div className="flex rounded-full border bg-muted p-0.5 gap-0.5">
                <button
                  onClick={() => setFilter("all")}
                  className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                    filter === "all" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter("my-communities")}
                  className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                    filter === "my-communities" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
                  }`}
                >
                  My Communities
                </button>
              </div>
            )}
          </div>

          {/* Community filter pills */}
          {myCommunities.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none mb-3">
              <button
                onClick={() => setActiveCommunityFilter(null)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
                  !activeCommunityFilter ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-muted"
                }`}
              >
                All Posts
              </button>
              {myCommunities.map(c => (
                <button
                  key={c.id}
                  onClick={() => setActiveCommunityFilter(activeCommunityFilter === c.id ? null : c.id)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
                    activeCommunityFilter === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-muted"
                  }`}
                >
                  📌 {c.name}
                </button>
              ))}
            </div>
          )}

          {/* Posts list */}
          {loading ? (
            <div className="space-y-4">
              {[0, 1, 2].map(i => (
                <div key={i} className="harvest-card p-4 space-y-3 animate-pulse">
                  <div className="flex gap-3">
                    <div className="h-9 w-9 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-32 rounded bg-muted" />
                      <div className="h-3 w-24 rounded bg-muted" />
                    </div>
                  </div>
                  <div className="h-4 w-full rounded bg-muted" />
                  <div className="h-4 w-3/4 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : visiblePosts.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No posts yet"
              description={
                activeCommunityFilter
                  ? "No posts in this community yet. Be the first!"
                  : "Be the first to share tips, ask questions, or start a discussion."
              }
              action={
                isAuthenticated
                  ? { label: "Create First Post", onClick: () => setShowCreate(true) }
                  : { label: "Sign in to post", onClick: () => navigate("/login") }
              }
            />
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {visiblePosts.map(post => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onDelete={handlePostDeleted}
                    onUpdate={(id, updates) => {
                      setPosts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
                    }}
                  />
                ))}
              </AnimatePresence>

              {hasMore && (
                <button
                  onClick={() => load(false)}
                  disabled={loadingMore}
                  className="w-full rounded-xl border bg-card py-3 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2"
                >
                  {loadingMore
                    ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> Loading...</>
                    : "Load more posts"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <CreatePostSheet
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handlePostCreated}
        communities={myCommunities}
        defaultCommunityId={activeCommunityFilter}
      />

      <CreateCommunitySheet
        open={showCreateCommunity}
        onClose={() => setShowCreateCommunity(false)}
        onCreated={(community) => {
          setCommunities(prev => [community, ...prev]);
          toast.success(`Welcome to ${community.name}!`);
        }}
      />
    </AppLayout>
  );
};

export default Community;
