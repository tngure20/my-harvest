import { Bell, Search, Leaf, LogIn, Home, ShoppingBag, Users, Sprout, Wrench, Bot } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";


const desktopNav = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/marketplace", icon: ShoppingBag, label: "Market" },
  { path: "/community", icon: Users, label: "Community" },
  { path: "/farm", icon: Sprout, label: "My Farm" },
  { path: "/toolkit", icon: Wrench, label: "Toolkit" },
  { path: "/assistant", icon: Bot, label: "Assistant" },
];

const AppHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate("/")} className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Leaf className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold text-foreground">Harvest</span>
          </button>

          {/* Desktop navigation links */}
          <nav className="hidden lg:flex items-center gap-1">
            {desktopNav
              .filter(item => isAuthenticated || !["/farm", "/toolkit", "/assistant"].includes(item.path))
              .map(item => {
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/search")}
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Search className="h-5 w-5" />
          </button>

          {isAuthenticated ? (
            <>
              <button
                onClick={() => navigate("/notifications")}
                className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Bell className="h-5 w-5" />
              </button>
              <button
                onClick={() => navigate("/profile")}
                className="hidden lg:flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20"
              >
                <Sprout className="h-5 w-5" />
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
            >
              <LogIn className="h-4 w-4" />
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
