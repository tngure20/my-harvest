import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { motion } from "framer-motion";
import { Plus, Wheat, Fish, Hexagon, ChevronRight, Calendar, ClipboardList, Sprout, LogIn, Loader2 } from "lucide-react";
import { Bug as Cow } from "lucide-react";
import { useNavigate } from "react-router-dom";
import CreateActivitySheet from "@/components/farm/CreateActivitySheet";
import ActivityTimeline from "@/components/farm/ActivityTimeline";
import EmptyState from "@/components/ui/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchFarmActivities,
  createFarmActivity,
  toggleFarmTask,
} from "@/lib/supabaseService";
import type { FarmActivity } from "@/lib/dataService";

const typeIcons = {
  crop: Wheat,
  livestock: Cow,
  poultry: Cow,
  aquaculture: Fish,
  beekeeping: Hexagon,
};

const typeColors = {
  crop: "bg-harvest-green-100 text-harvest-green-600",
  livestock: "bg-harvest-gold-100 text-harvest-gold-500",
  poultry: "bg-accent/20 text-accent-foreground",
  aquaculture: "bg-blue-100 text-harvest-sky",
  beekeeping: "bg-accent/20 text-accent-foreground",
};

const FarmManagement = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedActivity, setSelectedActivity] = useState<FarmActivity | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["/api/farm-activities", user?.id],
    queryFn: () => fetchFarmActivities(user!.id),
    enabled: !!user?.id,
  });

  const toggleTaskMutation = useMutation({
    mutationFn: ({ taskId, completed }: { taskId: string; completed: boolean }) =>
      toggleFarmTask(taskId, completed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/farm-activities", user?.id] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (activity: Omit<FarmActivity, "id" | "tasks" | "records">) =>
      createFarmActivity({
        user_id: user!.id,
        type: activity.type,
        name: activity.name,
        location: activity.location,
        size: activity.size,
        species: activity.species,
        start_date: activity.startDate || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/farm-activities", user?.id] });
      setShowCreate(false);
    },
  });

  if (!isAuthenticated) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <Sprout className="h-12 w-12 text-muted-foreground mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Farm Management</h1>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            Sign in to track your farm activities, manage tasks, and keep records of your agricultural operations.
          </p>
          <button
            onClick={() => navigate("/login")}
            className="flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground"
          >
            <LogIn className="h-4 w-4" /> Sign In to Get Started
          </button>
        </div>
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const upcomingTasks = activities
    .flatMap((a) => a.tasks.map((t) => ({ ...t, activityName: a.name, activityType: a.type, activityId: a.id })))
    .filter((t) => !t.completed)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);

  if (selectedActivity) {
    return (
      <AppLayout>
        <ActivityTimeline
          activity={selectedActivity}
          onBack={() => {
            setSelectedActivity(null);
            queryClient.invalidateQueries({ queryKey: ["/api/farm-activities", user?.id] });
          }}
          onToggleTask={(taskId) => {
            const task = selectedActivity.tasks.find((t) => t.id === taskId);
            if (!task) return;
            const newCompleted = !task.completed;
            toggleTaskMutation.mutate({ taskId, completed: newCompleted });
            setSelectedActivity((prev) =>
              prev ? { ...prev, tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, completed: newCompleted } : t)) } : prev
            );
          }}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-4 py-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Farm</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {activities.length} active activit{activities.length === 1 ? "y" : "ies"}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>

        {activities.length === 0 ? (
          <EmptyState
            icon={Sprout}
            title="No farm activities yet"
            description="Start by adding your first farm activity — a crop field, livestock herd, fish pond, or beehive."
            action={{ label: "Add Activity", onClick: () => setShowCreate(true) }}
          />
        ) : (
          <>
            {upcomingTasks.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-harvest-gold-100">
                    <Calendar className="h-4 w-4 text-harvest-gold-500" />
                  </div>
                  <h2 className="harvest-section-title">Upcoming Tasks</h2>
                </div>
                <div className="space-y-2">
                  {upcomingTasks.map((task) => (
                    <div key={task.id} className="harvest-card flex items-center gap-3 p-3">
                      <button
                        onClick={() => toggleTaskMutation.mutate({ taskId: task.id, completed: true })}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {task.activityName}
                          {task.dueDate && ` · Due ${new Date(task.dueDate).toLocaleDateString("en-KE", { month: "short", day: "numeric" })}`}
                        </p>
                      </div>
                      {task.category && (
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          {task.category}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-harvest-green-100">
                  <ClipboardList className="h-4 w-4 text-harvest-green-600" />
                </div>
                <h2 className="harvest-section-title">Farm Activities</h2>
              </div>
              <div className="space-y-3">
                {activities.map((activity) => {
                  const Icon = typeIcons[activity.type] || Sprout;
                  const colorClass = typeColors[activity.type] || "bg-primary/10 text-primary";
                  const pendingTasks = activity.tasks.filter((t) => !t.completed).length;
                  return (
                    <button
                      key={activity.id}
                      onClick={() => setSelectedActivity(activity)}
                      className="harvest-card w-full p-4 text-left transition-shadow hover:shadow-md"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colorClass}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-foreground">{activity.name}</h3>
                          <p className="text-[12px] text-muted-foreground mt-0.5">
                            {[activity.species, activity.size, activity.location].filter(Boolean).join(" · ")}
                          </p>
                          <div className="mt-2 flex items-center gap-3">
                            <span className="text-[11px] text-muted-foreground">
                              📋 {pendingTasks} pending task{pendingTasks !== 1 ? "s" : ""}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              📝 {activity.records.length} record{activity.records.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="mt-1 h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </div>

      <CreateActivitySheet
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onAdd={(activity) => {
          createMutation.mutate({ ...activity, userId: user!.id });
        }}
      />
    </AppLayout>
  );
};

export default FarmManagement;
