import { useState } from "react";
import { ThumbsUp, ThumbsDown, MessageCircle, Share2, Trash2, Flag, Ban, MoreHorizontal, Loader2, ExternalLink } from "lucide-react";
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
  deletePost,
  reportPost,
  sharePost,
  blockUser,
} from "@/lib/supabaseService";
import { useToast } from "@/hooks/use-toast";

interface PostCardProps {
  post: Post;
  onDeleted?: (id: string) => void;
}

const PostCard = ({ post, onDeleted }: PostCardProps) => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [userReaction, setUserReaction] = useState<"like" | "dislike" | null>(null);
  const [localLikes, setLocalLikes] = useState(post.likes);
  const [reactionLoaded, setReactionLoaded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const isOwner = isAuthenticated && user?.id === post.authorId;

  const loadReaction = async () => {
    if (!isAuthenticated || !user || reactionLoaded) return;
    const r = await getUserReactionSB(post.id, user.id);
    setUserReaction(r);
    setReactionLoaded(true);
  };

  const loadComments = async () => {
    setLoadingComments(true);
    const data = await fetchComments(post.id);
    setComments(data);
    setLoadingComments(false);
  };

  const handleToggleComments = async () => {
    if (!showComments) {
      await loadComments();
      await loadReaction();
    }
    setShowComments(!showComments);
  };

  const handleReact = async (type: "like" | "dislike") => {
    if (!isAuthenticated) { navigate("/login"); return; }
    if (!user) return;

    // Optimistic update
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

    try {
      const { newLikes, newReaction } = await toggleReactionSB(post.id, user.id, type);
      setLocalLikes(newLikes);
      setUserReaction(newReaction);
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });

      if (type === "like" && newReaction === "like" && post.authorId !== user.id) {
        await createNotificationSB({
          user_id: post.authorId,
          type: "like",
          message: `${user.name} liked your post`,  // no title or avatar_url in DB
        });
      }
    } catch {
      // Rollback on error
      setUserReaction(prev);
      setLocalLikes(post.likes);
    }
  };

  const handleComment = async () => {
    if (!isAuthenticated) { navigate("/login"); return; }
    if (!commentText.trim() || submitting || !user) return;
    setSubmitting(true);
    const optimisticComment: Comment = {
      id: `temp-${Date.now()}`,
      postId: post.id,
      authorId: user.id,
      authorName: user.name,
      authorAvatar: user.avatar,
      text: commentText.trim(),
      createdAt: new Date().toISOString(),
      reported: false,
    };
    setComments((prev) => [...prev, optimisticComment]);
    setCommentText("");

    try {
      await createComment({ post_id: post.id, user_id: user.id, content: optimisticComment.text });  // user_id not author_id
      if (post.authorId !== user.id) {
        await createNotificationSB({
          user_id: post.authorId,
          type: "comment",
          message: `${user.name} commented on your post`,  // no title or avatar_url in DB
        });
      }
      await loadComments();
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    } catch {
      setComments((prev) => prev.filter((c) => c.id !== optimisticComment.id));
      toast({ title: "Failed to post comment", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleShare = async () => {
    if (!isAuthenticated) { navigate("/login"); return; }
    if (!user) return;
    setShowMenu(false);
    try {
      await sharePost(post, user.id);
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      toast({ title: "Post shared to your feed" });
    } catch {
      toast({ title: "Failed to share post", variant: "destructive" });
    }
  };

  const handleCopyLink = () => {
    setShowMenu(false);
    const url = `${window.location.origin}/community?post=${post.id}`;
    navigator.clipboard.writeText(url).then(() => toast({ title: "Link copied!" }));
  };

  const handleDelete = async () => {
    if (!isOwner) return;
    setShowMenu(false);
    try {
      await deletePost(post.id);
      setDeleted(true);
      onDeleted?.(post.id);
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      toast({ title: "Post deleted" });
    } catch {
      toast({ title: "Failed to delete post", variant: "destructive" });
    }
  };

  const handleReport = async () => {
    if (!isAuthenticated) { navigate("/login"); return; }
    setShowMenu(false);
    try {
      await reportPost(post.id);
      toast({ title: "Post reported", description: "Thank you — our team will review it." });
    } catch {
      toast({ title: "Failed to report post", variant: "destructive" });
    }
  };

  const handleBlock = async () => {
    if (!isAuthenticated || !user) { navigate("/login"); return; }
    setShowMenu(false);
    try {
      await blockUser(user.id, post.authorId);
      setDeleted(true);
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      toast({ title: `${post.authorName} blocked`, description: "You won't see their posts anymore." });
    } catch {
      toast({ title: "Failed to block user", variant: "destructive" });
    }
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  if (deleted) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="harvest-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 pb-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary overflow-hidden">
          {post.authorAvatar?.startsWith("http") ? (
            <img src={post.authorAvatar} alt={post.authorName} className="h-full w-full object-cover rounded-full" />
          ) : (
            post.authorAvatar
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{post.authorName}</p>
          <p className="text-[11px] text-muted-foreground">
            {post.authorLocation && `${post.authorLocation} · `}{timeAgo(post.createdAt)}
            {post.communityName && <span className="ml-1 text-primary">· {post.communityName}</span>}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {post.tag && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{post.tag}</span>
          )}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted transition-colors"
            >
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </button>
            <AnimatePresence>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 top-8 z-50 min-w-[160px] rounded-xl border bg-card shadow-lg p-1"
                  >
                    <button onClick={handleShare} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors">
                      <Share2 className="h-4 w-4 text-muted-foreground" /> Repost
                    </button>
                    <button onClick={handleCopyLink} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors">
                      <ExternalLink className="h-4 w-4 text-muted-foreground" /> Copy link
                    </button>
                    {isOwner && (
                      <button onClick={handleDelete} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors">
                        <Trash2 className="h-4 w-4" /> Delete post
                      </button>
                    )}
                    {!isOwner && (
                      <>
                        <div className="my-1 h-px bg-border" />
                        <button onClick={handleReport} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors">
                          <Flag className="h-4 w-4" /> Report
                        </button>
                        <button onClick={handleBlock} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors">
                          <Ban className="h-4 w-4" /> Block user
                        </button>
                      </>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Shared post attribution */}
      {post.originalPostId && (
        <div className="mx-4 mb-2 rounded-lg border bg-muted/40 p-3">
          <p className="text-[11px] font-medium text-muted-foreground mb-1">
            Originally by {post.originalPostAuthorName}
          </p>
          <p className="text-xs text-foreground leading-relaxed line-clamp-3">
            {post.originalPostContent}
          </p>
        </div>
      )}

      {/* Content */}
      {post.text && (
        <div className="px-4 pb-3">
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{post.text}</p>
        </div>
      )}
      {post.imageUrl && (
        <div className="px-4 pb-3">
          <img src={post.imageUrl} alt="" className="w-full rounded-lg object-cover max-h-64" />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 border-t px-4 py-2">
        <button
          onClick={() => handleReact("like")}
          className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            userReaction === "like" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
          {localLikes > 0 && <span>{localLikes}</span>}
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
          {post.comments > 0 && <span>{post.comments}</span>}
        </button>
      </div>

      {/* Comments */}
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
