import { useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import { motion } from "framer-motion";
import {
  ChevronLeft, CalendarDays, Loader2, LogIn, CheckCircle2, Circle,
  CalendarClock, AlertCircle, CloudRain,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchFarmActivities, toggleFarmTask } from "@/lib/supabaseService";
import { useAuth } from "@/contexts/AuthContext";
import EmptyState from "@/components/ui/EmptyState";
import { getWeatherContext } from "@/services/weatherService";

type PlannedTask = {
  id: string;
  title: string;
  category: string;
  dueDate: string;            // ISO date string
  completed: boolean;
  activityId: string;
  activityName: string;
  activityType: string;
};

type Bucket = "overdue" | "today" | "thisWeek" | "later" | "completed";

const BUCKET_META: Record<Bucket, { label: string; color: string; emptyHint: string }> = {
  overdue:   { label: "Overdue",     color: "text-rose-600 dark:text-rose-400",     emptyHint: "Nothing overdue 🎉" },
  today:     { label: "Due today",   color: "text-amber-600 dark:text-amber-400",   emptyHint: "Nothing due today" },
  thisWeek:  { label: "This week",   color: "text-primary",                          emptyHint: "Nothing scheduled this week" },
  later:     { label: "Later",       color: "text-foreground",                       emptyHint: "No tasks beyond this week" },
  completed: { label: "Completed",   color: "text-muted-foreground",                 emptyHint: "Tick off tasks to see them here" },
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Parse a due-date string into a local-timezone Date.
 *  - "YYYY-MM-DD" is treated as that calendar day in the user's local timezone
 *    (NOT UTC midnight, which would shift the date by hours in any non-UTC zone).
 *  - Full ISO timestamps (with "T") are parsed normally and converted to local. */
function parseLocalDate(s: string): Date | null {
  if (!s) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function bucketFor(dueIso: string, completed: boolean): Bucket {
  if (completed) return "completed";
  const parsed = parseLocalDate(dueIso);
  if (!parsed) return "later";
  const due = startOfDay(parsed);
  const today = startOfDay(new Date());
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays <= 7) return "thisWeek";
  return "later";
}

function formatDue(dueIso: string): string {
  const d = parseLocalDate(dueIso);
  if (!d) return "No date";
  return d.toLocaleDateString("en-KE", { weekday: "short", month: "short", day: "numeric" });
}

const FarmPlanner = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["/api/farm-activities", user?.id],
    queryFn: () => fetchFarmActivities(user!.id),
    enabled: !!user?.id,
  });

  const { data: weather } = useQuery({
    queryKey: ["weather-context-planner"],
    queryFn: () => getWeatherContext(),
    staleTime: 30 * 60_000, // align with weather service cache
  });
  const topAlert = weather?.alerts?.[0];

  const toggleMutation = useMutation({
    mutationFn: ({ taskId, completed }: { taskId: string; completed: boolean }) =>
      toggleFarmTask(taskId, completed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/farm-activities", user?.id] });
    },
  });

  const tasks: PlannedTask[] = useMemo(() => {
    return activities.flatMap((a) =>
      a.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        category: t.category,
        dueDate: t.dueDate,
        completed: t.completed,
        activityId: a.id,
        activityName: a.name,
        activityType: a.type,
      }))
    );
  }, [activities]);

  const grouped = useMemo(() => {
    const init: Record<Bucket, PlannedTask[]> = {
      overdue: [], today: [], thisWeek: [], later: [], completed: [],
    };
    for (const t of tasks) {
      init[bucketFor(t.dueDate, t.completed)].push(t);
    }
    // Sort by due date ascending within each bucket
    (Object.keys(init) as Bucket[]).forEach((k) => {
      init[k].sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
    });
    return init;
  }, [tasks]);

  const totals = {
    pending: tasks.filter((t) => !t.completed).length,
    done: tasks.filter((t) => t.completed).length,
    overdue: grouped.overdue.length,
  };

  if (!isAuthenticated) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Farm Planner</h1>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            Sign in to schedule tasks across your crops, livestock, and other activities.
          </p>
          <button
            onClick={() => navigate("/login")}
            className="flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground"
            data-testid="button-sign-in-planner"
          >
            <LogIn className="h-4 w-4" /> Sign in
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

  return (
    <AppLayout>
      <div className="px-4 py-4 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
            aria-label="Go back"
            data-testid="button-back-planner"
          >
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground">Farm Planner</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              All your tasks, grouped by when they're due.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Pending" value={totals.pending} icon={CalendarClock} accent="text-primary" />
          <Stat label="Overdue" value={totals.overdue} icon={AlertCircle} accent="text-rose-600 dark:text-rose-400" />
          <Stat label="Done" value={totals.done} icon={CheckCircle2} accent="text-emerald-600 dark:text-emerald-400" />
        </div>

        {/* Weather alert banner — helps farmers re-plan tasks when severe weather is coming */}
        {topAlert && (
          <button
            type="button"
            onClick={() => navigate("/weather")}
            className="w-full text-left flex items-start gap-2 rounded-xl border border-amber-300/50 bg-amber-50 dark:border-amber-700/40 dark:bg-amber-950/30 p-3"
            data-testid="banner-weather-alert"
          >
            <CloudRain className="h-4 w-4 mt-0.5 text-amber-700 dark:text-amber-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                {topAlert.title}
              </p>
              <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 line-clamp-2">
                {topAlert.message}
              </p>
            </div>
          </button>
        )}

        {tasks.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No tasks yet"
            description="Create a farm activity in My Farm — tasks for that activity will show up here automatically."
            action={{ label: "Open My Farm", onClick: () => navigate("/farm") }}
          />
        ) : (
          <>
            {(["overdue", "today", "thisWeek", "later", "completed"] as Bucket[]).map((key) => {
              const list = grouped[key];
              if (key === "completed" && list.length === 0) return null;
              if (list.length === 0 && key !== "today") return null;
              return (
                <section key={key} aria-label={BUCKET_META[key].label}>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className={`harvest-section-title ${BUCKET_META[key].color}`}>
                      {BUCKET_META[key].label}
                    </h2>
                    <span className="text-[11px] text-muted-foreground">{list.length}</span>
                  </div>

                  {list.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic px-1">{BUCKET_META[key].emptyHint}</p>
                  ) : (
                    <div className="space-y-2">
                      {list.map((t, i) => (
                        <motion.div
                          key={t.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="harvest-card flex items-center gap-3 p-3"
                          data-testid={`task-${t.id}`}
                        >
                          <button
                            onClick={() =>
                              toggleMutation.mutate({ taskId: t.id, completed: !t.completed })
                            }
                            disabled={toggleMutation.isPending}
                            aria-label={t.completed ? "Mark as not done" : "Mark as done"}
                            className="shrink-0"
                            data-testid={`toggle-task-${t.id}`}
                          >
                            {t.completed ? (
                              <CheckCircle2 className="h-5 w-5 text-primary" />
                            ) : (
                              <Circle className="h-5 w-5 text-muted-foreground" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-medium truncate ${
                                t.completed ? "text-muted-foreground line-through" : "text-foreground"
                              }`}
                            >
                              {t.title}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {t.activityName} · {formatDue(t.dueDate)}
                            </p>
                          </div>
                          {t.category && (
                            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary capitalize">
                              {t.category}
                            </span>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}

            <div className="pt-2">
              <button
                onClick={() => navigate("/farm")}
                className="flex w-full items-center justify-center gap-2 rounded-full border bg-card px-4 py-2.5 text-sm font-medium text-foreground"
                data-testid="button-open-farm"
              >
                Manage activities in My Farm
              </button>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

const Stat = ({
  label, value, icon: Icon, accent,
}: {
  label: string;
  value: number;
  icon: typeof CheckCircle2;
  accent: string;
}) => (
  <div className="harvest-card flex flex-col items-start gap-1 p-3">
    <Icon className={`h-4 w-4 ${accent}`} />
    <p className="text-lg font-bold text-foreground">{value}</p>
    <p className="text-[11px] text-muted-foreground">{label}</p>
  </div>
);

export default FarmPlanner;
