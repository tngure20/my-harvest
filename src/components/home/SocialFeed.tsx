import { useState, useEffect } from "react";
import { Pencil, ArrowRight, ImageIcon, Users } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { fetchPosts, fetchCommunities, type SocialPost, type Community } from "@/services/socialService";
import EmptyState from "@/components/ui/EmptyState";
import PostCard from "@/components/community/PostCard";
import CreatePostSheet from "@/components/community/CreatePostSheet";

function Avatar({ src, name }: { src: string; name: string }) {
  const isUrl = src.startsWith("http");
  if (isUrl) return <img src={src} alt={name} className="h-9 w-9 rounded-full object-cover" />;
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
      {src}
    </div>
  );
}

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
      .then(([p, c]) => {
        setPosts(p);
        setCommunities((c as Community[]).filter((cm) => cm.isMember));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  const handleComposeClick = () => {
    if (!isAuthenticated) { navigate("/login"); return; }
    setShowCreate(true);
  };

  const handlePostCreated = (post: SocialPost) => {
    setPosts(prev => [post, ...prev].slice(0, 5));
  };

  const handlePostDeleted = (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="harvest-section-title">Community Feed</h2>
        <button
          onClick={() => navigate("/community")}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          See all <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {/* Compose bar */}
      <div className="harvest-card p-3 mb-4">
        {user ? (
          <div className="flex items-center gap-3">
            <Avatar src={user.avatar} name={user.name} />
            <button
              onClick={handleComposeClick}
              className="flex-1 rounded-full border bg-muted/50 px-4 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              What's on your mind?
            </button>
            <button
              onClick={handleComposeClick}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <ImageIcon className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => navigate("/login")}
            className="flex w-full items-center gap-3 text-left"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="flex-1 rounded-full border bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground">
              Sign in to share with farmers...
            </span>
          </button>
        )}
      </div>

      {/* Posts */}
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
          title="Nothing posted yet"
          description="Be the first farmer to share a tip or ask the community."
          action={
            isAuthenticated
              ? { label: "Write a Post", onClick: handleComposeClick }
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
            See all community posts →
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
