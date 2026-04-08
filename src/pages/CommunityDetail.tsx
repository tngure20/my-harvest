import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { ArrowLeft, Users, Plus, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  fetchPosts, fetchCommunity, joinCommunity, leaveCommunity,
  type SocialPost, type Community,
} from "@/services/socialService";
import PostCard from "@/components/community/PostCard";
import CreatePostSheet from "@/components/community/CreatePostSheet";
import EmptyState from "@/components/ui/EmptyState";

const PAGE_SIZE = 15;

const CommunityDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [community, setCommunity] = useState<Community | null>(null);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [joiningLeaving, setJoiningLeaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = async (reset = false) => {
    if (!id) return;
    if (reset) setLoading(true);
    else setLoadingMore(true);
    try {
      const offset = reset ? 0 : posts.length;
      const [newPosts, comm] = await Promise.all([
        fetchPosts({ limit: PAGE_SIZE, offset, communityId: id }),
        reset ? fetchCommunity(id) : Promise.resolve(community),
      ]);
      if (reset && comm) setCommunity(comm);
      setPosts(prev => reset ? newPosts : [...prev, ...newPosts]);
      setHasMore(newPosts.length === PAGE_SIZE);
    } catch {
      toast.error("Could not load community posts.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => { load(true); }, [id]);

  const handleJoinLeave = async () => {
    if (!isAuthenticated) { navigate("/login"); return; }
    if (!community) return;
    setJoiningLeaving(true);
    try {
      if (community.isMember) {
        await leaveCommunity(community.id);
        setCommunity(c => c ? { ...c, isMember: false, memberCount: Math.max(0, c.memberCount - 1) } : c);
        toast.success("You left this community.");
      } else {
        await joinCommunity(community.id);
        setCommunity(c => c ? { ...c, isMember: true, memberCount: c.memberCount + 1 } : c);
        toast.success("Joined! You can now post here.");
      }
    } catch {
      toast.error("Could not update membership.");
    } finally {
      setJoiningLeaving(false);
    }
  };

  const handlePostCreated = (post: SocialPost) => {
    setPosts(prev => [post, ...prev]);
  };

  const handlePostDeleted = (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  return (
    <AppLayout>
      {/* Back header */}
      <div className="sticky top-[57px] z-30 flex items-center gap-3 border-b bg-card/95 backdrop-blur-lg px-4 py-3">
        <button
          onClick={() => navigate("/community")}
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </button>
        <h2 className="flex-1 font-display text-base font-bold text-foreground truncate">
          {community?.name ?? "Community"}
        </h2>
        <button onClick={() => load(true)} disabled={loading} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Community hero card */}
        {community && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="harvest-card overflow-hidden">
            {community.imageUrl && (
              <img src={community.imageUrl} alt={community.name} className="h-32 w-full object-cover bg-muted"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            )}
            {!community.imageUrl && (
              <div className="h-24 w-full bg-gradient-to-br from-primary/20 via-primary/10 to-muted flex items-center justify-center">
                <Users className="h-10 w-10 text-primary/30" />
              </div>
            )}
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h2 className="font-display text-xl font-bold text-foreground">{community.name}</h2>
                  {community.description && (
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{community.description}</p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    <Users className="h-3 w-3 inline mr-1" />
                    {community.memberCount} member{community.memberCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <button
                  onClick={handleJoinLeave}
                  disabled={joiningLeaving}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    community.isMember
                      ? "border border-border text-muted-foreground hover:border-destructive hover:text-destructive"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  } disabled:opacity-40`}
                >
                  {joiningLeaving ? "..." : community.isMember ? "Leave" : "Join"}
                </button>
              </div>

              {community.isMember && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 py-2.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
                >
                  <Plus className="h-4 w-4" /> Post to this community
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Posts */}
        <div>
          <h3 className="harvest-section-title mb-3">Posts</h3>
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
          ) : posts.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No posts yet"
              description="Be the first to post in this community."
              action={
                community?.isMember
                  ? { label: "Create First Post", onClick: () => setShowCreate(true) }
                  : { label: "Join to post", onClick: handleJoinLeave }
              }
            />
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {posts.map(post => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onDelete={handlePostDeleted}
                    onUpdate={(id, updates) => setPosts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))}
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
                    : "Load more"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {community && (
        <CreatePostSheet
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={handlePostCreated}
          communities={community ? [community] : []}
          defaultCommunityId={community.id}
        />
      )}
    </AppLayout>
  );
};

export default CommunityDetail;
