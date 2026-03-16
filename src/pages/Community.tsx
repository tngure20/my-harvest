import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Users, MessageSquare, TrendingUp, Plus, LogIn, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import EmptyState from "@/components/ui/EmptyState";
import PostCard from "@/components/community/PostCard";
import CreatePostSheet from "@/components/community/CreatePostSheet";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPosts, createPost } from "@/lib/supabaseService";

const Community = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["/api/posts"],
    queryFn: fetchPosts,
  });

  const createMutation = useMutation({
    mutationFn: createPost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      setShowCreate(false);
    },
  });

  return (
    <AppLayout>
      <div className="px-4 py-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Community</h1>
          {isAuthenticated ? (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              <Plus className="h-4 w-4" /> New Post
            </button>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              <LogIn className="h-4 w-4" /> Sign in to post
            </button>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="harvest-section-title">Feed</h2>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : posts.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No posts yet"
              description="Be the first to share tips, ask questions, or start a discussion with fellow farmers."
              action={isAuthenticated ? { label: "Create Post", onClick: () => setShowCreate(true) } : undefined}
            />
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      </div>

      <CreatePostSheet
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={(data) => {
          if (!user) return;
          createMutation.mutate({
            author_id: user.id,
            content: data.text,
            tag: data.tag,
            image_url: data.imageUrl,
          });
        }}
      />
    </AppLayout>
  );
};

export default Community;
