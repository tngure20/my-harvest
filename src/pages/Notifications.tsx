import AppLayout from "@/components/AppLayout";
import { Heart, MessageCircle, UserPlus, ShoppingBag, AlertTriangle, Check } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

export interface Notification {
  id: string;
  type: "like" | "comment" | "follow" | "marketplace" | "alert";
  title: string;
  message: string;
  time: string;
  read: boolean;
  avatar?: string;
}

const initialNotifications: Notification[] = [
  { id: "1", type: "like", title: "Jane Wanjiku", message: "liked your post about maize harvesting", time: "5m ago", read: false, avatar: "JW" },
  { id: "2", type: "comment", title: "Peter Ochieng", message: "commented on your livestock update", time: "1h ago", read: false, avatar: "PO" },
  { id: "3", type: "follow", title: "Mary Akinyi", message: "started following you", time: "2h ago", read: false, avatar: "MA" },
  { id: "4", type: "alert", title: "Regional Alert", message: "Fall Armyworm outbreak reported in Nakuru County", time: "3h ago", read: true },
  { id: "5", type: "marketplace", title: "Listing Update", message: "Your avocado listing received a new inquiry", time: "5h ago", read: true },
  { id: "6", type: "like", title: "David Mwangi", message: "liked your comment on dairy farming tips", time: "8h ago", read: true, avatar: "DM" },
  { id: "7", type: "comment", title: "Grace Njeri", message: "replied to your question about drip irrigation", time: "1d ago", read: true, avatar: "GN" },
];

const iconMap = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  marketplace: ShoppingBag,
  alert: AlertTriangle,
};

const colorMap = {
  like: "text-destructive bg-destructive/10",
  comment: "text-primary bg-primary/10",
  follow: "text-accent-foreground bg-accent/20",
  marketplace: "text-primary bg-primary/10",
  alert: "text-destructive bg-destructive/10",
};

const Notifications = () => {
  const [notifications, setNotifications] = useState(initialNotifications);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <AppLayout>
      <div className="px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1 text-sm font-medium text-primary"
            >
              <Check className="h-4 w-4" /> Mark all read
            </button>
          )}
        </div>

        {unreadCount > 0 && (
          <p className="text-sm text-muted-foreground">
            {unreadCount} unread notification{unreadCount > 1 ? "s" : ""}
          </p>
        )}

        <div className="space-y-2">
          {notifications.map((notif, i) => {
            const Icon = iconMap[notif.type];
            return (
              <motion.button
                key={notif.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => markRead(notif.id)}
                className={`flex w-full items-start gap-3 rounded-xl p-3.5 text-left transition-colors ${
                  notif.read ? "bg-transparent hover:bg-muted/50" : "bg-primary/5 hover:bg-primary/10"
                }`}
              >
                {notif.avatar ? (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {notif.avatar}
                  </div>
                ) : (
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${colorMap[notif.type]}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">{notif.title}</span>{" "}
                    {notif.message}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{notif.time}</p>
                </div>
                {!notif.read && (
                  <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default Notifications;
