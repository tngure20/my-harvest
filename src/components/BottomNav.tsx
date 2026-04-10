import { Home, ShoppingBag, Users, Sprout, User, LogIn } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Hide on onboarding/auth pages
  if (
    location.pathname.startsWith("/onboarding") ||
    location.pathname.startsWith("/login") ||
    location.pathname.startsWith("/signup") ||
    location.pathname.startsWith("/forgot-password")
  ) {
    return null;
  }

  const tabs = isAuthenticated
    ? [
        { path: "/", icon: Home, label: "Home" },
        { path: "/marketplace", icon: ShoppingBag, label: "Market" },
        { path: "/farm", icon: Sprout, label: "My Farm" },
        { path: "/community", icon: Users, label: "Community" },
        { path: "/profile", icon: User, label: "Profile" },
      ]
    : [
        { path: "/", icon: Home, label: "Home" },
        { path: "/marketplace", icon: ShoppingBag, label: "Market" },
        { path: "/community", icon: Users, label: "Community" },
        { path: "/login", icon: LogIn, label: "Sign In" },
      ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur-lg safe-area-bottom lg:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-around py-2">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="relative flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 px-3 py-1.5 transition-colors"
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute -top-2 h-0.5 w-8 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <tab.icon
                className={`h-5 w-5 transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}
              />
              <span
                className={`text-[10px] font-medium transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
