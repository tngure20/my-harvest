import AppLayout from "@/components/AppLayout";
import { Settings, ChevronRight, MapPin, Edit, BookOpen, Star, ShoppingBag, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const farmingActivities = ["Crop Farming", "Dairy Farming", "Poultry"];

const menuItems = [
  { icon: Edit, label: "Edit Profile", desc: "Update your farming details", path: "/settings" },
  { icon: ShoppingBag, label: "My Listings", desc: "Manage marketplace items", path: "/marketplace" },
  { icon: Users, label: "Following", desc: "12 farmers you follow", path: "/community" },
  { icon: Star, label: "Saved Posts", desc: "Bookmarked content", path: "/community" },
  { icon: BookOpen, label: "Expert Directory", desc: "Find agricultural experts", path: "/experts" },
  { icon: Settings, label: "Settings", desc: "Notifications, privacy, theme", path: "/settings" },
];

const Profile = () => {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="px-4 py-4 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="harvest-card p-5"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
              F
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-foreground">Farmer User</h1>
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> Nairobi, Kenya
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {farmingActivities.map((act) => (
                  <span key={act} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                    {act}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 border-t pt-4">
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">24</p>
              <p className="text-[11px] text-muted-foreground">Posts</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">156</p>
              <p className="text-[11px] text-muted-foreground">Followers</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">12</p>
              <p className="text-[11px] text-muted-foreground">Following</p>
            </div>
          </div>
        </motion.div>

        <div className="space-y-1">
          {menuItems.map((item, i) => (
            <motion.button
              key={item.label}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.03 }}
              onClick={() => navigate(item.path)}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-muted"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <item.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-[11px] text-muted-foreground">{item.desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </motion.button>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Profile;
