import { useState, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import {
  Users, MessageSquare, Plus, LogIn, Loader2, TrendingUp,
  Settings, Trash2, UserMinus, Shield, X, ChevronLeft, Lock, Globe,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import EmptyState from "@/components/ui/EmptyState";
import PostCard from "@/components/community/PostCard";
import CreatePostSheet from "@/components/community/CreatePostSheet";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchPosts, createPost, fetchCommunities, createCommunity,
  joinCommunity, leaveCommunity, deleteCommunity, updateCommunity,
  fetchCommunityMembers, removeMemberFromCommunity, promoteMember,
  fetchBlockedUserIds,
} from "@/lib/supabaseService";
import type { Community, CommunityMember } from "@/lib/dataService";
import { useToast } from "@/hooks/use-toast";

type Tab = "feed" | "communities";

const EMOJIS = ["🌱", "🌾", "🐄", "🐓", "🐝", "🥕", "🌽", "🍅", "🌿", "💧", "☀️", "🌍"];

// ─── Community Card ───────────────────────────────────────────────────────────

const CommunityCard = ({
  community,
  onSelect,
  onJoin,
  onLeave,
  joining,
}: {
  community: Community;
  onSelect: (c: Community) => void;
  onJoin: (id: string) => void;
  onLeave: (id: string) => void;
  joining: string | null;
}) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const isMember = !!community.memberRole;

  return (
    <div className="harvest-card p-4 flex items-start gap-3">
      <button onClick={() => onSelect(community)} className="flex-1 flex items-start gap-3 text-left min-w-0">
        <span className="text-2xl shrink-0">{community.emoji}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-foreground truncate">{community.name}</p>
            {community.isPrivate ? (
              <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
            ) : (
              <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
            {community.memberRole === "admin" && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Admin</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{community.description}</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {community.membersCount.toLocaleString()} {community.membersCount === 1 ? "member" : "members"}
          </p>
        </div>
      </button>
      <button
        disabled={joining === community.id}
        onClick={() => {
          if (!isAuthenticated) { navigate("/login"); return; }
          isMember ? onLeave(community.id) : onJoin(community.id);
        }}
        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
          isMember
            ? "border border-border text-muted-foreground hover:bg-muted"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        }`}
      >
        {joining === community.id ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : isMember ? "Leave" : "Join"}
      </button>
    </div>
  );
};

// ─── Create Community Sheet ───────────────────────────────────────────────────

const CreateCommunitySheet = ({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description: string; emoji: string; is_private: boolean }) => void;
  submitting: boolean;
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("🌱");
  const [isPrivate, setIsPrivate] = useState(false);

  const reset = () => { setName(""); setDescription(""); setEmoji("🌱"); setIsPrivate(false); };
  const handleClose = () => { reset(); onClose(); };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-10 max-h-[90vh] overflow-y-auto rounded-t-2xl bg-card p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-foreground">Create Community</h2>
          <button onClick={handleClose} className="rounded-full bg-muted p-1.5">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Choose an emoji</label>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={`h-9 w-9 rounded-lg text-lg transition-colors ${emoji === e ? "bg-primary/10 ring-2 ring-primary" : "hover:bg-muted"}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Community name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Maize Farmers Kenya"
              className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
              maxLength={60}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this community about?"
              rows={3}
              className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Private community</p>
              <p className="text-xs text-muted-foreground">Only members can see posts</p>
            </div>
            <button
              onClick={() => setIsPrivate(!isPrivate)}
              className={`relative h-6 w-11 rounded-full transition-colors ${isPrivate ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${isPrivate ? "translate-x-5" : "translate-x-1"}`} />
            </button>
          </div>

          <button
            onClick={() => onSubmit({ name: name.trim(), description: description.trim(), emoji, is_private: isPrivate })}
            disabled={!name.trim() || submitting}
            className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Community"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Community Detail View ────────────────────────────────────────────────────

const CommunityDetail = ({
  community,
  userId,
  onBack,
  onPostCreated,
}: {
  community: Community;
  userId: string | undefined;
  onBack: () => void;
  onPostCreated: () => void;
}) => {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"posts" | "members">("posts");
  const [showCreate, setShowCreate] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState(community.name);
  const [editDesc, setEditDesc] = useState(community.description);
  const [editEmoji, setEditEmoji] = useState(community.emoji);

  const isAdmin = community.memberRole === "admin";

  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ["/api/posts", community.id],
    queryFn: () => fetchPosts({ communityId: community.id }),
  });

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ["/api/community-members", community.id],
    queryFn: () => fetchCommunityMembers(community.id),
    enabled: activeTab === "members",
  });

  const createPostMutation = useMutation({
    mutationFn: createPost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts", community.id] });
      onPostCreated();
      setShowCreate(false);
    },
  });

  const handleEditSave = async () => {
    try {
      await updateCommunity(community.id, { name: editName.trim(), description: editDesc.trim(), emoji: editEmoji });
      queryClient.invalidateQueries({ queryKey: ["/api/communities"] });
      setShowEditModal(false);
      toast({ title: "Community updated" });
    } catch {
      toast({ title: "Failed to update community", variant: "destructive" });
    }
  };

  const handleDeleteCommunity = async () => {
    if (!window.confirm(`Delete "${community.name}"? All posts will be removed.`)) return;
    try {
      await deleteCommunity(community.id);
      queryClient.invalidateQueries({ queryKey: ["/api/communities"] });
      onBack();
      toast({ title: "Community deleted" });
    } catch {
      toast({ title: "Failed to delete community", variant: "destructive" });
    }
  };

  const handleRemoveMember = async (m: CommunityMember) => {
    if (!window.confirm(`Remove ${m.profile?.name} from this community?`)) return;
    try {
      await removeMemberFromCommunity(community.id, m.userId);
      queryClient.invalidateQueries({ queryKey: ["/api/community-members", community.id] });
      toast({ title: `${m.profile?.name} removed` });
    } catch {
      toast({ title: "Failed to remove member", variant: "destructive" });
    }
  };

  const handlePromote = async (m: CommunityMember) => {
    try {
      await promoteMember(community.id, m.userId);
      queryClient.invalidateQueries({ queryKey: ["/api/community-members", community.id] });
      toast({ title: `${m.profile?.name} promoted to admin` });
    } catch {
      toast({ title: "Failed to promote member", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors">
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <span className="text-2xl">{community.emoji}</span>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-foreground truncate">{community.name}</h2>
          <p className="text-xs text-muted-foreground">{community.membersCount} members</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1">
            <button onClick={() => setShowEditModal(true)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors">
              <Settings className="h-4 w-4 text-muted-foreground" />
            </button>
            <button onClick={handleDeleteCommunity} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-destructive/10 transition-colors">
              <Trash2 className="h-4 w-4 text-destructive" />
            </button>
          </div>
        )}
      </div>

      {community.description && (
        <p className="text-sm text-muted-foreground px-1">{community.description}</p>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 rounded-xl bg-muted p-1">
        {(["posts", "members"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex-1 rounded-lg py-1.5 text-xs font-medium capitalize transition-colors ${
              activeTab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Post button */}
      {activeTab === "posts" && community.memberRole && (
        <button
          onClick={() => setShowCreate(true)}
          className="flex w-full items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          <Plus className="h-4 w-4" /> Share something with this community…
        </button>
      )}

      {/* Posts */}
      {activeTab === "posts" && (
        postsLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : posts.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No posts yet"
            description="Be the first to share in this community."
          />
        ) : (
          <div className="space-y-4">
            {posts.map((post) => <PostCard key={post.id} post={post} />)}
          </div>
        )
      )}

      {/* Members */}
      {activeTab === "members" && (
        membersLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="harvest-card p-3 flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary overflow-hidden">
                  {m.profile?.avatar?.startsWith("http") ? (
                    <img src={m.profile.avatar} alt={m.profile.name} className="h-full w-full object-cover rounded-full" />
                  ) : (m.profile?.avatar || "?")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{m.profile?.name}</p>
                  <p className="text-xs text-muted-foreground">{m.profile?.location || "Kenya"}</p>
                </div>
                {m.role === "admin" && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Admin</span>
                )}
                {isAdmin && m.userId !== userId && (
                  <div className="flex gap-1">
                    {m.role !== "admin" && (
                      <button onClick={() => handlePromote(m)} title="Promote to admin" className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted transition-colors">
                        <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    )}
                    <button onClick={() => handleRemoveMember(m)} title="Remove member" className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-destructive/10 transition-colors">
                      <UserMinus className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* Create post sheet */}
      <CreatePostSheet
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={(data) => {
          if (!user) return;
          createPostMutation.mutate({
            author_id: user.id,
            content: data.text,
            tag: data.tag,
            image_url: data.imageUrl,
            community_id: community.id,
          });
        }}
      />

      {/* Edit community modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={() => setShowEditModal(false)} />
          <div className="relative z-10 w-full max-h-[80vh] overflow-y-auto rounded-t-2xl bg-card p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground">Edit Community</h3>
              <button onClick={() => setShowEditModal(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((e) => (
                <button key={e} onClick={() => setEditEmoji(e)} className={`h-9 w-9 rounded-lg text-lg transition-colors ${editEmoji === e ? "bg-primary/10 ring-2 ring-primary" : "hover:bg-muted"}`}>{e}</button>
              ))}
            </div>
            <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
            <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary resize-none" />
            <button onClick={handleEditSave} disabled={!editName.trim()} className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-40">Save Changes</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Community Page ──────────────────────────────────────────────────────

const Community = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<Tab>("feed");
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [filterCommunityId, setFilterCommunityId] = useState<string | null>(null);

  const { data: blockedIds = [] } = useQuery({
    queryKey: ["/api/blocks", user?.id],
    queryFn: () => fetchBlockedUserIds(user!.id),
    enabled: !!user,
  });

  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ["/api/posts", filterCommunityId],
    queryFn: () => fetchPosts({
      communityId: filterCommunityId || undefined,
      blockedUserIds: blockedIds,
    }),
    enabled: activeTab === "feed",
  });

  const { data: communities = [], isLoading: communitiesLoading } = useQuery({
    queryKey: ["/api/communities", user?.id],
    queryFn: () => fetchCommunities(user?.id),
  });

  const createPostMutation = useMutation({
    mutationFn: createPost,
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["/api/posts", filterCommunityId] });
      const prev = queryClient.getQueryData<typeof posts>(["/api/posts", filterCommunityId]);
      const optimistic = {
        id: `temp-${Date.now()}`,
        authorId: payload.author_id,
        authorName: user?.name || "",
        authorAvatar: user?.avatar || "",
        authorLocation: user?.location || "",
        text: payload.content,
        tag: payload.tag,
        likes: 0,
        comments: 0,
        createdAt: new Date().toISOString(),
        reported: false,
        imageUrl: payload.image_url,
      };
      queryClient.setQueryData(["/api/posts", filterCommunityId], [optimistic, ...(prev || [])]);
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(["/api/posts", filterCommunityId], context.prev);
      toast({ title: "Failed to create post", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      setShowCreate(false);
    },
  });

  const createCommunityMutation = useMutation({
    mutationFn: (data: { name: string; description: string; emoji: string; is_private: boolean }) =>
      createCommunity({ creator_id: user!.id, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communities"] });
      setShowCreateCommunity(false);
      toast({ title: "Community created!" });
    },
    onError: () => toast({ title: "Failed to create community", variant: "destructive" }),
  });

  const handleJoin = useCallback(async (id: string) => {
    if (!user) return;
    setJoiningId(id);
    try {
      await joinCommunity(id, user.id);
      queryClient.invalidateQueries({ queryKey: ["/api/communities"] });
    } catch {
      toast({ title: "Failed to join community", variant: "destructive" });
    } finally {
      setJoiningId(null);
    }
  }, [user, queryClient, toast]);

  const handleLeave = useCallback(async (id: string) => {
    if (!user) return;
    setJoiningId(id);
    try {
      await leaveCommunity(id, user.id);
      queryClient.invalidateQueries({ queryKey: ["/api/communities"] });
    } catch {
      toast({ title: "Failed to leave community", variant: "destructive" });
    } finally {
      setJoiningId(null);
    }
  }, [user, queryClient, toast]);

  const myJoinedCommunities = communities.filter((c) => !!c.memberRole);

  // Community detail view
  if (selectedCommunity) {
    return (
      <AppLayout>
        <div className="px-4 py-4">
          <CommunityDetail
            community={selectedCommunity}
            userId={user?.id}
            onBack={() => setSelectedCommunity(null)}
            onPostCreated={() => queryClient.invalidateQueries({ queryKey: ["/api/posts"] })}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-4 py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Community</h1>
          {isAuthenticated ? (
            <div className="flex gap-2">
              {activeTab === "feed" && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                >
                  <Plus className="h-4 w-4" /> Post
                </button>
              )}
              {activeTab === "communities" && (
                <button
                  onClick={() => setShowCreateCommunity(true)}
                  className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                >
                  <Plus className="h-4 w-4" /> Create
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              <LogIn className="h-4 w-4" /> Sign in
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-muted p-1">
          {([
            { key: "feed", label: "Feed", icon: TrendingUp },
            { key: "communities", label: "Communities", icon: Users },
          ] as { key: Tab; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                activeTab === key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* ── FEED TAB ── */}
        {activeTab === "feed" && (
          <div className="space-y-4">
            {/* Community filter chips */}
            {myJoinedCommunities.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                <button
                  onClick={() => setFilterCommunityId(null)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
                    !filterCommunityId ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-muted"
                  }`}
                >
                  All
                </button>
                {myJoinedCommunities.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setFilterCommunityId(c.id === filterCommunityId ? null : c.id)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
                      filterCommunityId === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-muted"
                    }`}
                  >
                    {c.emoji} {c.name}
                  </button>
                ))}
              </div>
            )}

            {postsLoading ? (
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
                {posts.map((post) => <PostCard key={post.id} post={post} />)}
              </div>
            )}
          </div>
        )}

        {/* ── COMMUNITIES TAB ── */}
        {activeTab === "communities" && (
          <div className="space-y-3">
            {communitiesLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : communities.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No communities yet"
                description="Create the first community for farmers in your region or with your interests."
                action={isAuthenticated ? { label: "Create Community", onClick: () => setShowCreateCommunity(true) } : undefined}
              />
            ) : (
              <>
                {myJoinedCommunities.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Your Communities</p>
                    <div className="space-y-2">
                      {myJoinedCommunities.map((c) => (
                        <CommunityCard
                          key={c.id}
                          community={c}
                          onSelect={setSelectedCommunity}
                          onJoin={handleJoin}
                          onLeave={handleLeave}
                          joining={joiningId}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {communities.filter((c) => !c.memberRole).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 mt-4">Discover</p>
                    <div className="space-y-2">
                      {communities.filter((c) => !c.memberRole).map((c) => (
                        <CommunityCard
                          key={c.id}
                          community={c}
                          onSelect={setSelectedCommunity}
                          onJoin={handleJoin}
                          onLeave={handleLeave}
                          joining={joiningId}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Sheets */}
      <CreatePostSheet
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={(data) => {
          if (!user) return;
          createPostMutation.mutate({
            author_id: user.id,
            content: data.text,
            tag: data.tag,
            image_url: data.imageUrl,
          });
        }}
      />

      <CreateCommunitySheet
        open={showCreateCommunity}
        onClose={() => setShowCreateCommunity(false)}
        onSubmit={createCommunityMutation.mutate}
        submitting={createCommunityMutation.isPending}
      />
    </AppLayout>
  );
};

export default Community;
