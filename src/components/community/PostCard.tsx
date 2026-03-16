import { useState } from "react";
import { ThumbsUp, ThumbsDown, MessageCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Post, Comment } from "@/lib/dataService";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  fetchComments,
  createComment,
  toggleReactionSB,
  getUserReactionSB,
  createNotificationSB,
} from "@/lib/supabaseService";

interface PostCardProps {
  post: Post;
}

const PostCard = ({ post }: PostCardProps) => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [userReaction, setUserReaction] = useState<"like" | "dislike" | null>(null);
  const [localLikes, setLocalLikes] = useState(post.likes);

  const loadComments = async () => {
    setLoadingComments(true);
    const data = await fetchComments(post.id);
    setComments(data);
    setLoadingComments(false);
  };

  const handleToggleComments = async () => {
    if (!showComments) await loadComments();
    setShowComments(!showComments);
  };

  const handleReact = async (type: "like" | "dislike") => {
    if (!isAuthenticated) { navigate("/login"); return; }
    const prev = userReaction;
    if (prev === type) {
      setUserReaction(null);
      if (type === "like") setLocalLikes((l) => Math.max(0, l - 1));
    } else {
      if (prev === "dislike" && type === "like") setLocalLikes((l) => l + 1);
      else if (prev === "like" && type === "dislike") setLocalLikes((l) => Math.max(0, l - 1));
      else if (type === "like") setLocalLikes((l) => l + 1);
      setUserReaction(type);
    }
    await toggleReactionSB(post.id, user!.id, type);
    queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
  };

  const handleComment = async () => {
    if (!isAuthenticated) { navigate("/login"); return; }
    if (!commentText.trim() || submitting) return;
    setSubmitting(true);
    try {
      await createComment({
        post_id: post.id,
        author_id: user!.id,
        content: commentText.trim(),
      });
      if (post.authorId !== user!.id) {
        await createNotificationSB({
          user_id: post.authorId,
          type: "comment",
          title: "New comment",
          message: `${user!.name} commented on your post`,
          avatar_url: typeof user!.avatar === "string" ? user!.avatar : undefined,
        });
      }
      setCommentText("");
      await loadComments();
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    } finally {
      setSubmitting(false);
    }
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="harvest-card overflow-hidden">
      <div className="flex items-center gap-3 p-4 pb-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary overflow-hidden">
          {post.authorAvatar?.startsWith("http") ? (
            <img src={post.authorAvatar} alt={post.authorName} className="h-full w-full object-cover rounded-full" />
          ) : (
            post.authorAvatar
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{post.authorName}</p>
          <p className="text-[11px] text-muted-foreground">
            {post.authorLocation && `${post.authorLocation} · `}{timeAgo(post.createdAt)}
          </p>
        </div>
        {post.tag && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{post.tag}</span>
        )}
      </div>

      <div className="px-4 pb-3">
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{post.text}</p>
        {post.imageUrl && (
          <img src={post.imageUrl} alt="" className="mt-3 w-full rounded-lg object-cover max-h-64" />
        )}
      </div>

      <div className="flex items-center gap-1 border-t px-4 py-2">
        <button
          onClick={() => handleReact("like")}
          className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            userReaction === "like" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
          {localLikes > 0 && localLikes}
        </button>
        <button
          onClick={() => handleReact("dislike")}
          className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            userReaction === "dislike" ? "bg-destructive/10 text-destructive" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleToggleComments}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          {post.comments > 0 && post.comments}
        </button>
      </div>

      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t"
          >
            <div className="p-4 space-y-3">
              {loadingComments ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">No comments yet. Be the first!</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground overflow-hidden">
                      {c.authorAvatar?.startsWith("http") ? (
                        <img src={c.authorAvatar} alt={c.authorName} className="h-full w-full object-cover rounded-full" />
                      ) : (
                        c.authorAvatar
                      )}
                    </div>
                    <div className="flex-1 rounded-lg bg-muted/50 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">{c.authorName}</span>
                        <span className="text-[10px] text-muted-foreground">{timeAgo(c.createdAt)}</span>
                      </div>
                      <p className="text-xs text-foreground/90 mt-0.5">{c.text}</p>
                    </div>
                  </div>
                ))
              )}

              {isAuthenticated ? (
                <div className="flex gap-2">
                  <input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleComment()}
                    placeholder="Write a comment..."
                    className="flex-1 rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={handleComment}
                    disabled={!commentText.trim() || submitting}
                    className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-40 flex items-center gap-1"
                  >
                    {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Post"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => navigate("/login")}
                  className="w-full text-center text-xs text-primary font-medium py-2"
                >
                  Sign in to comment
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default PostCard;
