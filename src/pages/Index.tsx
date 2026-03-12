import AppLayout from "@/components/AppLayout";
import WeatherWidget from "@/components/home/WeatherWidget";
import FarmingAdvice from "@/components/home/FarmingAdvice";
import RegionalAlerts from "@/components/home/RegionalAlerts";
import AgriNews from "@/components/home/AgriNews";
import SocialFeed from "@/components/home/SocialFeed";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Leaf, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const Index = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const greeting = user ? `Welcome back, ${user.name} 🌾` : "Welcome to Harvest 🌾";

  return (
    <AppLayout>
      <div className="space-y-6 px-4 py-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {isAuthenticated ? "Good morning," : "Discover agriculture"}
          </p>
          <h1 className="text-2xl font-bold text-foreground">{greeting}</h1>
        </div>

        {/* Guest banner */}
        {!isAuthenticated && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="harvest-card overflow-hidden"
          >
            <div className="harvest-gradient p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                  <Leaf className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-primary-foreground">Join the Harvest Community</h2>
                  <p className="text-xs text-primary-foreground/80">Manage your farm, connect with farmers, access markets</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => navigate("/signup")}
                  className="flex items-center gap-1 rounded-full bg-card px-4 py-2 text-xs font-semibold text-primary"
                >
                  Create Account <ArrowRight className="h-3 w-3" />
                </button>
                <button
                  onClick={() => navigate("/login")}
                  className="rounded-full border border-white/30 px-4 py-2 text-xs font-medium text-primary-foreground"
                >
                  Sign In
                </button>
              </div>
            </div>
          </motion.div>
        )}

        <RegionalAlerts />
        <WeatherWidget />
        {isAuthenticated && <FarmingAdvice />}
        <AgriNews />
        <SocialFeed />
      </div>
    </AppLayout>
  );
};

export default Index;
