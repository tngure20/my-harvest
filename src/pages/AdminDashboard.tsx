import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Leaf, LogOut, Users, FileText, ShoppingBag, AlertTriangle, BookOpen, UserCheck,
  BarChart3, Trash2, Ban, CheckCircle, Plus, Edit, Eye, EyeOff, ChevronRight, Shield,
  X,
} from "lucide-react";
import {
  isAdmin, setCurrentUser, getPlatformStats,
  getUsers, updateUser, deleteUser,
  getPosts, deletePost,
  getListings, deleteListing, updateListing,
  getAllAlerts, createAlert, updateAlert, deleteAlert,
  getAllArticles, createArticle, updateArticle, deleteArticle,
  getExperts, updateExpert, deleteExpert,
  type User, type Post, type MarketplaceListing, type Alert, type Article, type Expert,
} from "@/lib/dataService";

type Tab = "overview" | "users" | "posts" | "marketplace" | "alerts" | "articles" | "experts";

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "users", label: "Users", icon: Users },
  { id: "posts", label: "Posts", icon: FileText },
  { id: "marketplace", label: "Market", icon: ShoppingBag },
  { id: "alerts", label: "Alerts", icon: AlertTriangle },
  { id: "articles", label: "Articles", icon: BookOpen },
  { id: "experts", label: "Experts", icon: UserCheck },
];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  useEffect(() => {
    if (!isAdmin()) {
      navigate("/admin/login");
    }
  }, [navigate]);

  const handleLogout = () => {
    setCurrentUser(null);
    navigate("/admin/login");
  };

  if (!isAdmin()) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Leaf className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <span className="font-display text-lg font-bold text-foreground">Harvest</span>
              <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">ADMIN</span>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-4">
        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-3 scrollbar-none">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="mt-2">
          {activeTab === "overview" && <OverviewPanel />}
          {activeTab === "users" && <UsersPanel />}
          {activeTab === "posts" && <PostsPanel />}
          {activeTab === "marketplace" && <MarketplacePanel />}
          {activeTab === "alerts" && <AlertsPanel />}
          {activeTab === "articles" && <ArticlesPanel />}
          {activeTab === "experts" && <ExpertsPanel />}
        </div>
      </div>
    </div>
  );
};

// ─── Overview ────────────────────────────────────────────────────────────────

const OverviewPanel = () => {
  const stats = getPlatformStats();
  const cards = [
    { label: "Total Users", value: stats.totalUsers, icon: Users, color: "bg-primary/10 text-primary" },
    { label: "Total Posts", value: stats.totalPosts, icon: FileText, color: "bg-harvest-gold-100 text-harvest-gold-500" },
    { label: "Listings", value: stats.totalListings, icon: ShoppingBag, color: "bg-blue-100 text-harvest-sky" },
    { label: "Experts", value: stats.totalExperts, icon: UserCheck, color: "bg-harvest-green-100 text-harvest-green-600" },
    { label: "Active Alerts", value: stats.totalAlerts, icon: AlertTriangle, color: "bg-destructive/10 text-destructive" },
    { label: "Articles", value: stats.totalArticles, icon: BookOpen, color: "bg-accent/20 text-accent-foreground" },
    { label: "Reported Posts", value: stats.reportedPosts, icon: Shield, color: "bg-destructive/10 text-destructive" },
    { label: "Pending Experts", value: stats.pendingExperts, icon: UserCheck, color: "bg-harvest-gold-100 text-harvest-gold-500" },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="harvest-card p-4">
          <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-lg ${card.color}`}>
            <card.icon className="h-4 w-4" />
          </div>
          <p className="text-2xl font-bold text-foreground">{card.value}</p>
          <p className="text-[11px] text-muted-foreground">{card.label}</p>
        </div>
      ))}
    </motion.div>
  );
};

// ─── Users ───────────────────────────────────────────────────────────────────

const UsersPanel = () => {
  const [users, setUsers] = useState<User[]>(getUsers());
  const refresh = () => setUsers(getUsers());

  const handleSuspend = (id: string, suspended: boolean) => {
    updateUser(id, { suspended: !suspended });
    refresh();
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this user permanently?")) {
      deleteUser(id);
      refresh();
    }
  };

  const handleRoleChange = (id: string, role: User["role"]) => {
    updateUser(id, { role });
    refresh();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
      {users.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">No users registered yet.</p>}
      {users.map((user) => (
        <div key={user.id} className="harvest-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {user.avatar}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{user.name}</p>
                <p className="text-[11px] text-muted-foreground">{user.email} · {user.location}</p>
                <div className="mt-1 flex items-center gap-2">
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, e.target.value as User["role"])}
                    className="rounded border bg-background px-2 py-0.5 text-[11px] text-foreground"
                  >
                    <option value="farmer">Farmer</option>
                    <option value="business">Business</option>
                    <option value="expert">Expert</option>
                    <option value="general">General</option>
                    <option value="admin">Admin</option>
                  </select>
                  {user.suspended && <span className="rounded bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">Suspended</span>}
                </div>
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => handleSuspend(user.id, user.suspended)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" title={user.suspended ? "Unsuspend" : "Suspend"}>
                <Ban className="h-4 w-4" />
              </button>
              <button onClick={() => handleDelete(user.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </motion.div>
  );
};

// ─── Posts ────────────────────────────────────────────────────────────────────

const PostsPanel = () => {
  const [posts, setPosts] = useState<Post[]>(getPosts());
  const refresh = () => setPosts(getPosts());

  const handleDelete = (id: string) => {
    deletePost(id);
    refresh();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
      {posts.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">No posts yet.</p>}
      {posts.map((post) => (
        <div key={post.id} className={`harvest-card p-4 ${post.reported ? "border-destructive/30" : ""}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{post.authorName}</p>
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{post.text}</p>
              <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                <span>❤️ {post.likes}</span>
                <span>💬 {post.comments}</span>
                {post.reported && <span className="text-destructive font-medium">⚠️ Reported</span>}
              </div>
            </div>
            <button onClick={() => handleDelete(post.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </motion.div>
  );
};

// ─── Marketplace ─────────────────────────────────────────────────────────────

const MarketplacePanel = () => {
  const [listings, setListings] = useState<MarketplaceListing[]>(getListings());
  const refresh = () => setListings(getListings());

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
      {listings.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">No marketplace listings yet.</p>}
      {listings.map((listing) => (
        <div key={listing.id} className="harvest-card p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{listing.title}</p>
              <p className="text-xs text-primary font-bold">{listing.price}</p>
              <p className="text-[11px] text-muted-foreground">{listing.sellerName} · {listing.location}</p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => { deleteListing(listing.id); refresh(); }} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </motion.div>
  );
};

// ─── Alerts ──────────────────────────────────────────────────────────────────

const AlertsPanel = () => {
  const [alerts, setAlerts] = useState<Alert[]>(getAllAlerts());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", text: "", type: "pest" as Alert["type"], severity: "medium" as Alert["severity"], region: "" });
  const refresh = () => setAlerts(getAllAlerts());

  const handleCreate = () => {
    if (!form.title || !form.text || !form.region) return;
    createAlert(form);
    setForm({ title: "", text: "", type: "pest", severity: "medium", region: "" });
    setShowForm(false);
    refresh();
  };

  const toggleActive = (id: string, active: boolean) => {
    updateAlert(id, { active: !active });
    refresh();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
      <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
        <Plus className="h-4 w-4" /> Create Alert
      </button>

      {showForm && (
        <div className="harvest-card p-4 space-y-3">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Alert title" className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary placeholder:text-muted-foreground" />
          <textarea value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder="Alert description" rows={2} className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary placeholder:text-muted-foreground" />
          <div className="flex gap-2">
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Alert["type"] })} className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm">
              <option value="pest">Pest</option>
              <option value="disease">Disease</option>
              <option value="weather">Weather</option>
              <option value="advisory">Advisory</option>
            </select>
            <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as Alert["severity"] })} className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm">
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="Region (e.g., Nakuru County)" className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary placeholder:text-muted-foreground" />
          <div className="flex gap-2">
            <button onClick={handleCreate} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Publish</button>
            <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm text-foreground">Cancel</button>
          </div>
        </div>
      )}

      {alerts.length === 0 && !showForm && <p className="py-12 text-center text-sm text-muted-foreground">No alerts created yet.</p>}
      {alerts.map((alert) => (
        <div key={alert.id} className={`harvest-card p-4 ${!alert.active ? "opacity-50" : ""}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${alert.severity === "high" ? "bg-destructive/10 text-destructive" : alert.severity === "medium" ? "bg-harvest-gold-100 text-harvest-gold-500" : "bg-muted text-muted-foreground"}`}>
                  {alert.severity.toUpperCase()}
                </span>
                <span className="text-[10px] text-muted-foreground">{alert.type} · {alert.region}</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-foreground">{alert.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{alert.text}</p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => toggleActive(alert.id, alert.active)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" title={alert.active ? "Deactivate" : "Activate"}>
                {alert.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button onClick={() => { deleteAlert(alert.id); refresh(); }} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </motion.div>
  );
};

// ─── Articles ────────────────────────────────────────────────────────────────

const ArticlesPanel = () => {
  const [articles, setArticles] = useState<Article[]>(getAllArticles());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", tag: "", readTime: "5 min", authorId: "admin-001", authorName: "Harvest Admin", published: true });
  const refresh = () => setArticles(getAllArticles());

  const handleCreate = () => {
    if (!form.title || !form.content) return;
    createArticle(form);
    setForm({ title: "", content: "", tag: "", readTime: "5 min", authorId: "admin-001", authorName: "Harvest Admin", published: true });
    setShowForm(false);
    refresh();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
      <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
        <Plus className="h-4 w-4" /> New Article
      </button>

      {showForm && (
        <div className="harvest-card p-4 space-y-3">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Article title" className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary placeholder:text-muted-foreground" />
          <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Article content..." rows={6} className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary placeholder:text-muted-foreground" />
          <div className="flex gap-2">
            <input value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} placeholder="Tag (e.g., Crop Farming)" className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary placeholder:text-muted-foreground" />
            <input value={form.readTime} onChange={(e) => setForm({ ...form, readTime: e.target.value })} placeholder="Read time" className="w-24 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary placeholder:text-muted-foreground" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Publish</button>
            <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm text-foreground">Cancel</button>
          </div>
        </div>
      )}

      {articles.length === 0 && !showForm && <p className="py-12 text-center text-sm text-muted-foreground">No articles published yet.</p>}
      {articles.map((article) => (
        <div key={article.id} className={`harvest-card p-4 ${!article.published ? "opacity-50" : ""}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{article.title}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{article.tag} · {article.readTime} · {article.published ? "Published" : "Draft"}</p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => { updateArticle(article.id, { published: !article.published }); refresh(); }} className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
                {article.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button onClick={() => { deleteArticle(article.id); refresh(); }} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </motion.div>
  );
};

// ─── Experts ─────────────────────────────────────────────────────────────────

const ExpertsPanel = () => {
  const [experts, setExperts] = useState<Expert[]>(getExperts());
  const refresh = () => setExperts(getExperts());

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
      {experts.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">No expert applications yet.</p>}
      {experts.map((expert) => (
        <div key={expert.id} className="harvest-card p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">{expert.name}</p>
              <p className="text-[11px] text-primary">{expert.specialization}</p>
              <p className="text-[11px] text-muted-foreground">{expert.location} · {expert.experience}</p>
              <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${expert.approved ? "bg-harvest-green-100 text-harvest-green-600" : "bg-harvest-gold-100 text-harvest-gold-500"}`}>
                {expert.approved ? "Approved" : "Pending Approval"}
              </span>
            </div>
            <div className="flex gap-1">
              {!expert.approved && (
                <button onClick={() => { updateExpert(expert.id, { approved: true }); refresh(); }} className="rounded-lg p-2 text-muted-foreground hover:bg-harvest-green-100 hover:text-harvest-green-600" title="Approve">
                  <CheckCircle className="h-4 w-4" />
                </button>
              )}
              <button onClick={() => { deleteExpert(expert.id); refresh(); }} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </motion.div>
  );
};

export default AdminDashboard;
