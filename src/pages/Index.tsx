import { useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import WeatherWidget from "@/components/home/WeatherWidget";
import FarmingAdvice from "@/components/home/FarmingAdvice";
import RegionalAlerts from "@/components/home/RegionalAlerts";
import AgriNews from "@/components/home/AgriNews";
import SocialFeed from "@/components/home/SocialFeed";
import TodaysTasks from "@/components/home/TodaysTasks";
import QuickActions from "@/components/home/QuickActions";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Leaf, ArrowRight, MapPin } from "lucide-react";
import { motion } from "framer-motion";

import { runFarmIntelligence } from "@/services/farmIntelligenceService";
import { fetchFarmRecords } from "@/services/farmService";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning,";
  if (h < 17) return "Good afternoon,";
  return "Good evening,";
}

const Index = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const farmTypeEmoji: Record<string, string> = {
    crop: "🌾",
    livestock: "🐄",
    poultry: "🐔",
    aquaculture: "🐟",
    beekeeping: "🐝",
    fruit: "🥭",
    mixed: "🌿",
  };

  const primaryType = user?.farmingActivities?.[0];
  const emoji = primaryType ? (farmTypeEmoji[primaryType] ?? "🌾") : "🌾";

  // ─────────────────────────────────────────────
  // 🧠 FARM BRAIN (runs quietly in background)
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    let cancelled = false;

    async function runBrain() {
      try {
        const records = await fetchFarmRecords();

        if (cancelled) return;

        await runFarmIntelligence(
          user.id,
          "Generate today's farm priorities based on weather, season, and farm status",
          records
        );
      } catch (err) {
        console.warn("Farm brain error:", err);
      }
    }

    runBrain();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user]);

  return (
    <AppLayout>
      <div className="space-y-6 px-4 py-4 lg:py-6">

        {/* HEADER */}
        <div>
          <p className="text-sm text-muted-foreground">
            {isAuthenticated ? getGreeting() : "Discover agriculture"}
          </p>

          <h1 className="text-2xl font-bold text-foreground">
            {user
              ? `${user.name.split(" ")[0]} ${emoji}`
              : "Welcome to Harvest 🌾"}
          </h1>

          {user?.location && (
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>{user.location}</span>
            </div>
          )}
        </div>

        {/* GUEST BANNER */}
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
                  <h2 className="text-sm font-bold text-primary-foreground">
                    Join the Harvest Community
                  </h2>
                  <p className="text-xs text-primary-foreground/80">
                    Manage your farm, connect with farmers, access markets
                  </p>
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

        {/* ========================= */}
        {/* 🟢 ACTION LAYER */}
        {/* ========================= */}

        {isAuthenticated && <QuickActions />}
        {isAuthenticated && <TodaysTasks />}

        {/* ========================= */}
        {/* 🔴 RISK LAYER */}
        {/* ========================= */}

        <RegionalAlerts />
        <WeatherWidget />

        {/* ========================= */}
        {/* 🟡 INSIGHT LAYER */}
        {/* ========================= */}

        {isAuthenticated && <FarmingAdvice />}
        <AgriNews />
        <SocialFeed />

      </div>
    </AppLayout>
  );
};

export default Index;
