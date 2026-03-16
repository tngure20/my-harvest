import AppLayout from "@/components/AppLayout";
import { Heart, MessageCircle, UserPlus, ShoppingBag, AlertTriangle, Check, Bell, LogIn, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import EmptyState from "@/components/ui/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchNotifications,
  markNotificationReadSB,
  markAllNotificationsReadSB,
} from "@/lib/supabaseService";

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
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["/api/notifications", user?.id],
    queryFn: () => fetchNotifications(user!.id),
    enabled: !!user?.id,
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationReadSB,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications", user?.id] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllNotificationsReadSB(user!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications", user?.id] }),
  });

  if (!isAuthenticated) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <Bell className="h-12 w-12 text-muted-foreground mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Notifications</h1>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            Sign in to see your notifications.
          </p>
          <button
            onClick={() => navigate("/login")}
            className="flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground"
          >
            <LogIn className="h-4 w-4" /> Sign In
          </button>
        </div>
      </AppLayout>
    );
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <AppLayout>
      <div className="px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="flex items-center gap-1 text-sm font-medium text-primary"
            >
              <Check className="h-4 w-4" /> Mark all read
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications"
            description="You're all caught up! Notifications will appear here when someone interacts with your content."
          />
        ) : (
          <>
            {unreadCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {unreadCount} unread notification{unreadCount > 1 ? "s" : ""}
              </p>
            )}

            <div className="space-y-2">
              {notifications.map((notif, i) => {
                const Icon = iconMap[notif.type as keyof typeof iconMap] || Bell;
                const color = colorMap[notif.type as keyof typeof colorMap] || "text-primary bg-primary/10";
                return (
                  <motion.button
                    key={notif.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => !notif.read && markReadMutation.mutate(notif.id)}
                    className={`flex w-full items-start gap-3 rounded-xl p-3.5 text-left transition-colors ${
                      notif.read ? "bg-transparent hover:bg-muted/50" : "bg-primary/5 hover:bg-primary/10"
                    }`}
                  >
                    {notif.avatar ? (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary overflow-hidden">
                        {notif.avatar.startsWith("http") ? (
                          <img src={notif.avatar} alt="" className="h-full w-full object-cover rounded-full" />
                        ) : (
                          notif.avatar
                        )}
                      </div>
                    ) : (
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">
                        <span className="font-semibold">{notif.title}</span>{" "}
                        {notif.message}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {new Date(notif.createdAt).toLocaleDateString("en-KE", {
                          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                    {!notif.read && (
                      <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default Notifications;
