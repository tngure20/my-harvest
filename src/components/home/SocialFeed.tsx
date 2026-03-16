import { Heart, MessageCircle, Pencil } from "lucide-react";
import { motion } from "framer-motion";
import EmptyState from "@/components/ui/EmptyState";
import { useQuery } from "@tanstack/react-query";
import { fetchPosts } from "@/lib/supabaseService";

const SocialFeed = () => {
  const { data: posts = [] } = useQuery({
    queryKey: ["/api/posts"],
    queryFn: fetchPosts,
  });

  if (posts.length === 0) {
    return (
      <div>
        <h2 className="harvest-section-title mb-3">Community Feed</h2>
        <EmptyState
          icon={Pencil}
          title="No posts yet"
          description="Be the first to share farming tips, ask questions, or post updates with the community."
        />
      </div>
    );
  }

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
    >
      <h2 className="harvest-section-title mb-3">Community Feed</h2>
      <div className="space-y-4">
        {posts.slice(0, 5).map((post) => (
          <div key={post.id} className="harvest-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary overflow-hidden">
                {post.authorAvatar?.startsWith("http") ? (
                  <img src={post.authorAvatar} alt={post.authorName} className="h-full w-full object-cover rounded-full" />
                ) : (
                  post.authorAvatar
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{post.authorName}</p>
                <p className="text-[11px] text-muted-foreground">
                  {post.authorLocation && `${post.authorLocation} · `}{timeAgo(post.createdAt)}
                </p>
              </div>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-foreground line-clamp-3">{post.text}</p>

            {post.tag && (
              <div className="mt-2">
                <span className="inline-block rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-secondary-foreground">
                  {post.tag}
                </span>
              </div>
            )}

            <div className="mt-3 flex items-center gap-6 border-t pt-3">
              <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <Heart className="h-4 w-4" /> {post.likes}
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <MessageCircle className="h-4 w-4" /> {post.comments}
              </span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default SocialFeed;
