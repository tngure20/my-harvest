import { useState, useEffect } from "react";
import { Pencil, Plus, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { fetchPosts, createPost, fetchCommunities, type SocialPost, type Community } from "@/services/socialService";
import EmptyState from "@/components/ui/EmptyState";
import PostCard from "@/components/community/PostCard";
import CreatePostSheet from "@/components/community/CreatePostSheet";

const SocialFeed = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchPosts({ limit: 5 }),
      isAuthenticated ? fetchCommunities() : Promise.resolve([]),
    ])
      .then(([p, c]) => { setPosts(p); setCommunities(c.filter((cm: Community) => cm.isMember)); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  const handlePostCreated = (post: SocialPost) => {
    setPosts(prev => [post, ...prev].slice(0, 5));
  };

  const handlePostDeleted = (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="harvest-section-title">Community Feed</h2>
        <div className="flex items-center gap-2">
          {isAuthenticated && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
            >
              <Plus className="h-3 w-3" /> Post
            </button>
          )}
          <button
            onClick={() => navigate("/community")}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            All <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[0, 1].map(i => (
            <div key={i} className="harvest-card p-4 space-y-3 animate-pulse">
              <div className="flex gap-3">
                <div className="h-9 w-9 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 rounded bg-muted" />
                  <div className="h-3 w-24 rounded bg-muted" />
                </div>
              </div>
              <div className="h-4 w-full rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={Pencil}
          title="No posts yet"
          description="Be the first to share a tip or ask the community."
          action={
            isAuthenticated
              ? { label: "Create Post", onClick: () => setShowCreate(true) }
              : { label: "Sign in to post", onClick: () => navigate("/login") }
          }
        />
      ) : (
        <div className="space-y-4">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onDelete={handlePostDeleted}
              onUpdate={(id, updates) => setPosts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))}
            />
          ))}
          <button
            onClick={() => navigate("/community")}
            className="w-full rounded-xl border bg-card py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            See all posts in Community →
          </button>
        </div>
      )}

      <CreatePostSheet
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handlePostCreated}
        communities={communities}
      />
    </motion.div>
  );
};

export default SocialFeed;
