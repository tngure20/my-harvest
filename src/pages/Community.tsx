import AppLayout from "@/components/AppLayout";
import { Users, MessageSquare, TrendingUp, Plus, LogIn } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { getGroups, getPosts } from "@/lib/dataService";
import EmptyState from "@/components/ui/EmptyState";
import { useAuth } from "@/contexts/AuthContext";

const Community = () => {
  const groups = getGroups();
  const posts = getPosts();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="px-4 py-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Community</h1>
          {isAuthenticated ? (
            <button className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
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
          <h2 className="harvest-section-title mb-3">Groups</h2>
          {groups.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No groups yet"
              description="Farming groups will appear here. Start connecting with fellow farmers!"
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {groups.map((group, i) => (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="harvest-card p-4 cursor-pointer transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{group.emoji}</span>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-foreground">{group.name}</h3>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" /> {group.members.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" /> {group.postsPerWeek} posts/wk
                        </span>
                      </div>
                    </div>
                    <button className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20">
                      Join
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="harvest-section-title">Recent Posts</h2>
          </div>
          {posts.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No posts yet"
              description="Be the first to share tips, ask questions, or start a discussion."
            />
          ) : (
            <div className="space-y-3">
              {posts.slice(0, 5).map((post) => (
                <div key={post.id} className="harvest-card p-4 cursor-pointer transition-shadow hover:shadow-md">
                  <p className="text-sm font-medium text-foreground line-clamp-2">{post.text}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {post.authorName} · {new Date(post.createdAt).toLocaleDateString("en-KE", { month: "short", day: "numeric" })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Community;
