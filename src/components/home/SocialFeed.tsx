import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { getPosts, createPost } from "@/lib/dataService";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import EmptyState from "@/components/ui/EmptyState";
import PostCard from "@/components/community/PostCard";
import CreatePostSheet from "@/components/community/CreatePostSheet";

const SocialFeed = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState(() => getPosts());
  const [showCreate, setShowCreate] = useState(false);
  const refresh = () => setPosts(getPosts());

  const displayedPosts = posts.slice(0, 5);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="harvest-section-title">Community Feed</h2>
        {isAuthenticated ? (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
          >
            <Plus className="h-3 w-3" /> Post
          </button>
        ) : (
          <button
            onClick={() => navigate("/community")}
            className="text-xs font-medium text-primary hover:underline"
          >
            View all
          </button>
        )}
      </div>

      {posts.length === 0 ? (
        <EmptyState
          icon={Pencil}
          title="No posts yet"
          description="Be the first to share farming tips or ask the community a question."
          action={isAuthenticated ? { label: "Create Post", onClick: () => setShowCreate(true) } : { label: "Sign in to post", onClick: () => navigate("/login") }}
        />
      ) : (
        <>
          <div className="space-y-4">
            {displayedPosts.map((post) => (
              <PostCard key={post.id} post={post} onUpdate={refresh} />
            ))}
          </div>
          {posts.length > 5 && (
            <button
              onClick={() => navigate("/community")}
              className="mt-3 w-full rounded-xl border bg-card py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              View all {posts.length} posts in community →
            </button>
          )}
        </>
      )}

      <CreatePostSheet
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={(data) => {
          if (!user) return;
          createPost({
            authorId: user.id,
            authorName: user.name,
            authorAvatar: user.avatar,
            authorLocation: user.location || "Unknown",
            text: data.text,
            tag: data.tag,
            imageUrl: data.imageUrl,
          });
          setShowCreate(false);
          refresh();
        }}
      />
    </motion.div>
  );
};

export default SocialFeed;
