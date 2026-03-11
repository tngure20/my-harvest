import { ArrowLeft, Check, Plus, Calendar, FileText } from "lucide-react";
import { motion } from "framer-motion";
import type { FarmActivity } from "@/pages/FarmManagement";
import { useState } from "react";

interface ActivityTimelineProps {
  activity: FarmActivity;
  onBack: () => void;
  onToggleTask: (taskId: string) => void;
}

const ActivityTimeline = ({ activity, onBack, onToggleTask }: ActivityTimelineProps) => {
  const [tab, setTab] = useState<"tasks" | "records">("tasks");

  return (
    <div className="px-4 py-4 space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-4 w-4 text-foreground" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">{activity.name}</h1>
          <p className="text-xs text-muted-foreground">
            {activity.species} · {activity.size} · Started {new Date(activity.startDate).toLocaleDateString("en-KE", { month: "short", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-muted p-1">
        <button
          onClick={() => setTab("tasks")}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
            tab === "tasks" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          <Calendar className="mr-1.5 inline h-4 w-4" />
          Tasks ({activity.tasks.length})
        </button>
        <button
          onClick={() => setTab("records")}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
            tab === "records" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          <FileText className="mr-1.5 inline h-4 w-4" />
          Records ({activity.records.length})
        </button>
      </div>

      {tab === "tasks" && (
        <div className="space-y-2">
          {activity.tasks.map((task, i) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="harvest-card flex items-start gap-3 p-3"
            >
              <button
                onClick={() => onToggleTask(task.id)}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  task.completed ? "border-primary bg-primary" : "border-muted-foreground/40"
                }`}
              >
                {task.completed && <Check className="h-3 w-3 text-primary-foreground" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${task.completed ? "text-muted-foreground line-through" : "text-foreground"}`}>
                  {task.title}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {new Date(task.dueDate).toLocaleDateString("en-KE", { weekday: "short", month: "short", day: "numeric" })}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {task.category}
              </span>
            </motion.div>
          ))}
        </div>
      )}

      {tab === "records" && (
        <div className="space-y-3">
          {activity.records.map((record, i) => (
            <motion.div
              key={record.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="harvest-card p-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                    {record.type}
                  </span>
                  <p className="mt-1.5 text-sm text-foreground">{record.description}</p>
                  {record.quantity && (
                    <p className="mt-1 text-xs text-muted-foreground">Qty: {record.quantity}</p>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(record.date).toLocaleDateString("en-KE", { month: "short", day: "numeric" })}
                </p>
              </div>
            </motion.div>
          ))}

          <button className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 p-3 text-sm font-medium text-primary transition-colors hover:bg-primary/5">
            <Plus className="h-4 w-4" /> Log New Record
          </button>
        </div>
      )}
    </div>
  );
};

export default ActivityTimeline;
