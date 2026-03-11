import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Wheat, Fish, Hexagon, ChevronRight, Calendar, ClipboardList, TrendingUp } from "lucide-react";
import { Bug as Cow } from "lucide-react";
import CreateActivitySheet from "@/components/farm/CreateActivitySheet";
import ActivityTimeline from "@/components/farm/ActivityTimeline";

export type FarmActivity = {
  id: string;
  type: "crop" | "livestock" | "poultry" | "aquaculture" | "beekeeping";
  name: string;
  location: string;
  size: string;
  species: string;
  startDate: string;
  tasks: FarmTask[];
  records: FarmRecord[];
};

export type FarmTask = {
  id: string;
  title: string;
  dueDate: string;
  completed: boolean;
  category: string;
};

export type FarmRecord = {
  id: string;
  type: string;
  description: string;
  date: string;
  quantity?: string;
};

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
  poultry: "bg-amber-100 text-amber-600",
  aquaculture: "bg-blue-100 text-harvest-sky",
  beekeeping: "bg-amber-100 text-amber-600",
};

// Demo data
const demoActivities: FarmActivity[] = [
  {
    id: "1",
    type: "crop",
    name: "Maize Field - Block A",
    location: "Nakuru, Kenya",
    size: "3 acres",
    species: "Maize (H614D)",
    startDate: "2026-02-15",
    tasks: [
      { id: "t1", title: "Germination check", dueDate: "2026-03-01", completed: true, category: "Monitoring" },
      { id: "t2", title: "First fertilizer application (DAP)", dueDate: "2026-03-10", completed: true, category: "Fertilizer" },
      { id: "t3", title: "Pest scouting — Fall Armyworm", dueDate: "2026-03-15", completed: false, category: "Pest Control" },
      { id: "t4", title: "Top dressing (CAN)", dueDate: "2026-03-25", completed: false, category: "Fertilizer" },
      { id: "t5", title: "Weeding", dueDate: "2026-04-05", completed: false, category: "Maintenance" },
      { id: "t6", title: "Estimated harvest", dueDate: "2026-06-15", completed: false, category: "Harvest" },
    ],
    records: [
      { id: "r1", type: "Planting", description: "Planted 3 acres of H614D maize", date: "2026-02-15", quantity: "30 kg seed" },
      { id: "r2", type: "Fertilizer", description: "Applied DAP at planting", date: "2026-02-15", quantity: "150 kg" },
    ],
  },
  {
    id: "2",
    type: "livestock",
    name: "Dairy Herd",
    location: "Nakuru, Kenya",
    size: "15 head",
    species: "Friesian cattle",
    startDate: "2025-06-01",
    tasks: [
      { id: "t7", title: "Vaccination — East Coast Fever", dueDate: "2026-03-20", completed: false, category: "Health" },
      { id: "t8", title: "Deworming schedule", dueDate: "2026-04-01", completed: false, category: "Health" },
      { id: "t9", title: "Breeding check — Cow #7", dueDate: "2026-03-18", completed: false, category: "Breeding" },
    ],
    records: [
      { id: "r3", type: "Production", description: "Average daily milk production", date: "2026-03-10", quantity: "120 litres" },
    ],
  },
];

const FarmManagement = () => {
  const [activities, setActivities] = useState<FarmActivity[]>(demoActivities);
  const [selectedActivity, setSelectedActivity] = useState<FarmActivity | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const upcomingTasks = activities
    .flatMap((a) => a.tasks.map((t) => ({ ...t, activityName: a.name, activityType: a.type })))
    .filter((t) => !t.completed)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);

  const toggleTask = (activityId: string, taskId: string) => {
    setActivities((prev) =>
      prev.map((a) =>
        a.id === activityId
          ? { ...a, tasks: a.tasks.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t)) }
          : a
      )
    );
  };

  if (selectedActivity) {
    return (
      <AppLayout>
        <ActivityTimeline
          activity={selectedActivity}
          onBack={() => setSelectedActivity(null)}
          onToggleTask={(taskId) => {
            toggleTask(selectedActivity.id, taskId);
            setSelectedActivity((prev) =>
              prev
                ? { ...prev, tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t)) }
                : prev
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
            <p className="text-sm text-muted-foreground mt-1">{activities.length} active activities</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>

        {/* Upcoming Tasks */}
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
                    onClick={() => {
                      const activity = activities.find((a) => a.tasks.some((t) => t.id === task.id));
                      if (activity) toggleTask(activity.id, task.id);
                    }}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-primary"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {task.activityName} · Due {new Date(task.dueDate).toLocaleDateString("en-KE", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    {task.category}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Farm Activities */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-harvest-green-100">
              <ClipboardList className="h-4 w-4 text-harvest-green-600" />
            </div>
            <h2 className="harvest-section-title">Farm Activities</h2>
          </div>
          <div className="space-y-3">
            {activities.map((activity) => {
              const Icon = typeIcons[activity.type];
              const colorClass = typeColors[activity.type];
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
                        {activity.species} · {activity.size} · {activity.location}
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

        {/* Calculations summary */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Auto-Calculations</h3>
          </div>
          <div className="space-y-1.5 text-sm text-muted-foreground">
            <p>🌾 Maize Field: ~450 kg fertilizer needed (150 kg DAP + 300 kg CAN for 3 acres)</p>
            <p>🐄 Dairy Herd: ~225 kg daily feed requirement (15 kg/head × 15 head)</p>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground italic">
            ⚠️ These are estimates based on your activity data. Always consult agricultural professionals.
          </p>
        </motion.div>
      </div>

      <CreateActivitySheet
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onAdd={(activity) => {
          setActivities((prev) => [...prev, activity]);
          setShowCreate(false);
        }}
      />
    </AppLayout>
  );
};

export default FarmManagement;
