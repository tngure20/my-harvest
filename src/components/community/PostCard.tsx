import { useState, useCallback } from "react";
import { ThumbsUp, ThumbsDown, MessageCircle, Share2, Trash2, MoreHorizontal, Send, X, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  toggleReaction, fetchComments, createComment, deletePost, sharePost,
  type SocialPost, type SocialComment,
} from "@/services/socialService";

interface Props {
  post: SocialPost;
  onDelete?: (postId: string) => void;
  onUpdate?: (postId: string, updates: Partial<SocialPost>) => void;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-KE", { month: "short", day: "numeric" });
}

function Avatar({ src, name, size = 9 }: { src: string; name: string; size?: number }) {
  const isUrl = src.startsWith("http");
  const cls = `flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary`;
  const dim = `h-${size} w-${size}`;
  if (isUrl) return <img src={src} alt={name} className={`${dim} rounded-full object-cover`} />;
  return <div className={`${cls} ${dim}`}>{src}</div>;
}

// ─── Share Sheet ──────────────────────────────────────────────────────────────

interface ShareSheetProps {
  post: SocialPost;
  open: boolean;
  onClose: () => void;
  onShared: (newPost: SocialPost) => void;
}

const ShareSheet = ({ post, open, onClose, onShared }: ShareSheetProps) => {
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCopyLink = () => {
    const url = `${window.location.origin}/community?post=${post.id}`;
    navigator.clipboard.writeText(url).then(() => toast.success("Link copied!"));
  };

  const handleRepost = async () => {
    setLoading(true);
    try {
      const newPost = await sharePost(post.id, comment.trim());
      toast.success("Reposted successfully!");
      onShared(newPost);
      setComment("");
      onClose();
    } catch {
      toast.error("Could not repost. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-card p-5 shadow-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-base font-bold text-foreground">Share Post</h3>
              <button onClick={onClose} className="rounded-full bg-muted p-1.5">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Preview of original post */}
            <div className="mb-4 rounded-xl border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">{post.authorName}</p>
              <p className="text-sm text-foreground line-clamp-2">{post.text}</p>
            </div>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add your thoughts (optional)..."
              rows={2}
              className="mb-4 w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
            />

            <div className="flex gap-3">
              <button
                onClick={handleCopyLink}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <ExternalLink className="h-4 w-4" /> Copy Link
              </button>
              <button
                onClick={handleRepost}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-40"
              >
                {loading
                  ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  : <Share2 className="h-4 w-4" />}
                Repost
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// ─── Comment Item ─────────────────────────────────────────────────────────────

const CommentItem = ({ c, currentUserId }: { c: SocialComment; currentUserId?: string }) => (
  <div className="flex gap-2">
    <Avatar src={c.authorAvatar} name={c.authorName} size={7} />
    <div className="flex-1 rounded-xl bg-muted/50 px-3 py-2">
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-xs font-semibold text-foreground">{c.authorName}</span>
        <span className="text-[10px] text-muted-foreground">{timeAgo(c.createdAt)}</span>
      </div>
      <p className="text-xs text-foreground/90 leading-relaxed">{c.text}</p>
    </div>
  </div>
);

// ─── PostCard ─────────────────────────────────────────────────────────────────

const PostCard = ({ post, onDelete, onUpdate }: Props) => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Optimistic local state for reactions
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [dislikeCount, setDislikeCount] = useState(post.dislikeCount);
  const [userReaction, setUserReaction] = useState<"like" | "dislike" | null>(post.userReaction);

  // Comments
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<SocialComment[]>([]);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // UI
  const [showShare, setShowShare] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwner = user?.id === post.userId;

  // ── Reaction ────────────────────────────────────────────────────────────────
  const handleReact = useCallback(async (type: "like" | "dislike") => {
    if (!isAuthenticated) { navigate("/login"); return; }

    const prev = { likeCount, dislikeCount, userReaction };

    // Optimistic update
    if (userReaction === type) {
      setUserReaction(null);
      if (type === "like") setLikeCount(n => Math.max(0, n - 1));
      else setDislikeCount(n => Math.max(0, n - 1));
    } else {
      if (userReaction === "like") setLikeCount(n => Math.max(0, n - 1));
      if (userReaction === "dislike") setDislikeCount(n => Math.max(0, n - 1));
      setUserReaction(type);
      if (type === "like") setLikeCount(n => n + 1);
      else setDislikeCount(n => n + 1);
    }

    try {
      await toggleReaction(post.id, type, userReaction);
    } catch {
      // Rollback
      setLikeCount(prev.likeCount);
      setDislikeCount(prev.dislikeCount);
      setUserReaction(prev.userReaction);
      toast.error("Could not save reaction. Please try again.");
    }
  }, [isAuthenticated, navigate, post.id, likeCount, dislikeCount, userReaction]);

  // ── Comments ─────────────────────────────────────────────────────────────────
  const loadComments = async () => {
    if (loadingComments) return;
    setLoadingComments(true);
    try {
      const data = await fetchComments(post.id);
      setComments(data);
    } catch {
      toast.error("Could not load comments.");
    } finally {
      setLoadingComments(false);
    }
  };

  const handleToggleComments = () => {
    const next = !showComments;
    setShowComments(next);
    if (next && comments.length === 0) loadComments();
  };

  const handleComment = async () => {
    if (!isAuthenticated) { navigate("/login"); return; }
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    const optimistic: SocialComment = {
      id: `opt-${Date.now()}`,
      postId: post.id,
      userId: user!.id,
      text: commentText.trim(),
      createdAt: new Date().toISOString(),
      authorName: user!.name,
      authorAvatar: user!.avatar,
    };
    setComments(prev => [...prev, optimistic]);
    setCommentCount(n => n + 1);
    setCommentText("");
    try {
      const saved = await createComment(post.id, optimistic.text);
      setComments(prev => prev.map(c => c.id === optimistic.id ? saved : c));
    } catch {
      setComments(prev => prev.filter(c => c.id !== optimistic.id));
      setCommentCount(n => Math.max(0, n - 1));
      toast.error("Comment failed. Please try again.");
    } finally {
      setSubmittingComment(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setShowMenu(false);
    setDeleting(true);
    try {
      await deletePost(post.id);
      toast.success("Post deleted.");
      onDelete?.(post.id);
    } catch {
      toast.error("Could not delete post.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: deleting ? 0 : 1, scale: deleting ? 0.95 : 1, y: 0 }}
        className="harvest-card overflow-hidden"
      >
        {/* Community badge */}
        {post.community && (
          <div className="flex items-center gap-2 border-b bg-primary/5 px-4 py-2">
            <span className="text-[11px] font-medium text-primary">📌 {post.community.name}</span>
          </div>
        )}

        {/* Repost indicator */}
        {post.originalPostId && (
          <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2">
            <Share2 className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">
              {post.authorName} reposted
            </span>
          </div>
        )}

        {/* Author row */}
        <div className="flex items-center gap-3 p-4 pb-2">
          <Avatar src={post.authorAvatar} name={post.authorName} size={9} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{post.authorName}</p>
            <p className="text-[11px] text-muted-foreground">
              {post.authorLocation && `${post.authorLocation} · `}
              {timeAgo(post.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              {post.tag}
            </span>
            {isOwner && (
              <div className="relative">
                <button
                  onClick={() => setShowMenu(v => !v)}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                <AnimatePresence>
                  {showMenu && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                      className="absolute right-0 z-30 mt-1 w-32 rounded-xl border bg-card shadow-lg overflow-hidden"
                    >
                      <button
                        onClick={handleDelete}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-destructive hover:bg-muted"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Text content */}
        {post.text && (
          <div className="px-4 pb-3">
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{post.text}</p>
          </div>
        )}

        {/* Original post embed (repost) */}
        {post.originalPost && (
          <div className="mx-4 mb-3 rounded-xl border bg-muted/30 p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <Avatar src={post.originalPost.authorAvatar} name={post.originalPost.authorName} size={6} />
              <span className="text-xs font-semibold text-foreground">{post.originalPost.authorName}</span>
              <span className="text-[10px] text-muted-foreground">{timeAgo(post.originalPost.createdAt)}</span>
            </div>
            <p className="text-xs text-foreground/90 leading-relaxed line-clamp-3">{post.originalPost.text}</p>
            {post.originalPost.imageUrl && (
              <img src={post.originalPost.imageUrl} alt="" className="mt-2 w-full rounded-lg object-cover max-h-40" />
            )}
          </div>
        )}

        {/* Media */}
        {post.imageUrl && !post.originalPost && (
          <div className="px-4 pb-3">
            <img src={post.imageUrl} alt="" className="w-full rounded-xl object-cover max-h-72 bg-muted" />
          </div>
        )}
        {post.videoUrl && (
          <div className="px-4 pb-3">
            <video src={post.videoUrl} controls className="w-full rounded-xl max-h-72 bg-muted" />
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center gap-1 border-t px-3 py-2">
          <button
            onClick={() => handleReact("like")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              userReaction === "like"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            {likeCount > 0 && <span>{likeCount}</span>}
          </button>

          <button
            onClick={() => handleReact("dislike")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              userReaction === "dislike"
                ? "bg-destructive/10 text-destructive"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <ThumbsDown className="h-3.5 w-3.5" />
            {dislikeCount > 0 && <span>{dislikeCount}</span>}
          </button>

          <button
            onClick={handleToggleComments}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              showComments
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {commentCount > 0 && <span>{commentCount}</span>}
          </button>

          <button
            onClick={() => isAuthenticated ? setShowShare(true) : navigate("/login")}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ml-auto"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Comments section */}
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
                  <div className="flex justify-center py-3">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-2">No comments yet. Be the first!</p>
                ) : (
                  comments.map(c => (
                    <CommentItem key={c.id} c={c} currentUserId={user?.id} />
                  ))
                )}

                {isAuthenticated ? (
                  <div className="flex gap-2">
                    <Avatar src={user!.avatar} name={user!.name} size={7} />
                    <div className="flex flex-1 items-center gap-2 rounded-xl border bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-primary">
                      <input
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleComment()}
                        placeholder="Write a comment..."
                        className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                      />
                      <button
                        onClick={handleComment}
                        disabled={!commentText.trim() || submittingComment}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-primary disabled:opacity-40"
                      >
                        <Send className="h-3 w-3 text-primary-foreground" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => navigate("/login")}
                    className="w-full text-center text-xs font-medium text-primary py-2"
                  >
                    Sign in to comment
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <ShareSheet
        post={post}
        open={showShare}
        onClose={() => setShowShare(false)}
        onShared={(newPost) => onUpdate?.(post.id, {})}
      />
    </>
  );
};

export default PostCard;
