import { useState, useEffect, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Wheat, Fish, Hexagon, ChevronRight, Calendar,
  Sprout, LogIn, ArrowLeft, Bot, Check, Trash2,
  AlertTriangle, TrendingUp, ClipboardList, RefreshCw, Bell,
  Wrench, X, Heart, Syringe, Scale,
} from "lucide-react";
import { Bug as Cow } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  fetchFarmRecords, fetchFarmActivities, fetchFarmTasks,
  deleteFarmRecord, completeActivity, deleteDbFarmActivity,
  createDbFarmActivity, completeTask, deleteTask, createFarmTask,
  generateSmartTasks,
  type FarmRecord, type DbFarmActivity, type FarmTask,
} from "@/services/farmService";
import CreateFarmRecordSheet from "@/components/farm/CreateFarmRecordSheet";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// ─── Config ───────────────────────────────────────────────
const TYPE_CFG: Record<string, { Icon: typeof Wheat; color: string; label: string }> = {
  crop:        { Icon: Wheat,   color: "bg-green-100 text-green-700",  label: "Crop" },
  livestock:   { Icon: Cow,    color: "bg-amber-100 text-amber-700",   label: "Livestock" },
  poultry:     { Icon: Cow,    color: "bg-orange-100 text-orange-700", label: "Poultry" },
  aquaculture: { Icon: Fish,   color: "bg-blue-100 text-blue-700",     label: "Aquaculture" },
  beekeeping:  { Icon: Hexagon,color: "bg-yellow-100 text-yellow-700", label: "Beekeeping" },
  equipment:   { Icon: Wrench, color: "bg-gray-100 text-gray-700",     label: "Equipment" },
};
const HEALTH_CFG: Record<string, string> = {
  healthy: "bg-green-100 text-green-700",
  at_risk: "bg-amber-100 text-amber-700",
  affected: "bg-red-100 text-red-700",
};
const PRIORITY_CFG: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
};
const ACT_TYPES = ["irrigation","fertilization","pesticide","harvesting","soil_testing","observation","other"];

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}
function fmtDate(dateStr?: string) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

// ─── Record Card ──────────────────────────────────────────
function RecordCard({ record, onClick, onDelete }: {
  record: FarmRecord; onClick: () => void; onDelete: () => void;
}) {
  const cfg = TYPE_CFG[record.recordType] ?? TYPE_CFG.crop;
  const { Icon } = cfg;
  const days = daysUntil(record.expectedHarvestDate);

  return (
    <div className="harvest-card relative overflow-hidden p-4">
      <button className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={e => { e.stopPropagation(); onDelete(); }}>
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      <button onClick={onClick} className="flex w-full items-start gap-3 text-left pr-6">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${cfg.color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground truncate">{record.name}</h3>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${HEALTH_CFG[record.healthStatus] ?? HEALTH_CFG.healthy}`}>
              {record.healthStatus.replace("_", " ")}
            </span>
          </div>
          {record.cropType && <p className="mt-0.5 text-xs text-muted-foreground">{record.cropType}</p>}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {record.areaPlanted && (
              <span className="text-[11px] text-muted-foreground">📐 {record.areaPlanted} {record.areaUnit}</span>
            )}
            {days !== null && days > 0 && (
              <span className="text-[11px] font-medium text-primary">🌾 {days}d to harvest</span>
            )}
            {days !== null && days <= 0 && (
              <span className="text-[11px] font-medium text-amber-600">⚠️ Harvest due!</span>
            )}
            {record.growthStage && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground capitalize">
                {record.growthStage}
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    </div>
  );
}

// ─── Activity Row ─────────────────────────────────────────
function ActivityRow({ act, onComplete, onDelete }: {
  act: DbFarmActivity; onComplete: () => void; onDelete: () => void;
}) {
  const EMOJI: Record<string, string> = {
    irrigation: "💧", fertilization: "🌿", pesticide: "🛡️",
    harvesting: "🌾", soil_testing: "🔬", observation: "👁️", other: "📋",
  };
  const days = daysUntil(act.startTime.split("T")[0]);
  const overdue = days !== null && days < 0;

  return (
    <div className={`harvest-card flex items-center gap-3 p-3 ${act.isCompleted ? "opacity-50" : ""}`}>
      <button
        onClick={onComplete}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          act.isCompleted ? "border-primary bg-primary" : "border-muted-foreground/40"
        }`}
      >
        {act.isCompleted && <Check className="h-3 w-3 text-primary-foreground" />}
      </button>
      <span className="text-lg shrink-0">{EMOJI[act.activityType] ?? "📋"}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${act.isCompleted ? "line-through text-muted-foreground" : "text-foreground"}`}>
          {act.title}
        </p>
        <p className={`text-[11px] ${overdue && !act.isCompleted ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
          {overdue && !act.isCompleted ? "Overdue · " : ""}{fmtDate(act.startTime)}
        </p>
      </div>
      <button onClick={onDelete} className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-destructive">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Task Row ─────────────────────────────────────────────
function TaskRow({ task, onComplete, onDelete }: {
  task: FarmTask; onComplete: () => void; onDelete: () => void;
}) {
  const overdue = task.dueDate && daysUntil(task.dueDate)! < 0 && !task.isCompleted;
  return (
    <div className="harvest-card flex items-center gap-3 p-3">
      <button
        onClick={onComplete}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          task.isCompleted ? "border-primary bg-primary" : "border-muted-foreground/40"
        }`}
      >
        {task.isCompleted && <Check className="h-3 w-3 text-primary-foreground" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${task.isCompleted ? "line-through text-muted-foreground" : "text-foreground"}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {task.dueDate && (
            <span className={`text-[11px] ${overdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
              {overdue ? "Overdue · " : ""}{fmtDate(task.dueDate)}
            </span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY_CFG[task.priority] ?? PRIORITY_CFG.medium}`}>
            {task.priority}
          </span>
          {task.taskType === "ai_generated" && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">AI</span>
          )}
        </div>
      </div>
      <button onClick={onDelete} className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-destructive">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Livestock Health Log ─────────────────────────────────
interface HealthEntry {
  id: string;
  date: string;
  type: "vaccination" | "treatment" | "weight" | "observation";
  note: string;
  weight?: number;
  vaccineName?: string;
}

const HEALTH_LOG_KEY = "harvest_health_logs";

function loadHealthLogs(recordId: string): HealthEntry[] {
  try {
    const raw = localStorage.getItem(`${HEALTH_LOG_KEY}_${recordId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHealthLog(recordId: string, logs: HealthEntry[]) {
  localStorage.setItem(`${HEALTH_LOG_KEY}_${recordId}`, JSON.stringify(logs));
}

const HEALTH_ENTRY_TYPES = [
  { value: "vaccination", label: "Vaccination", icon: "💉" },
  { value: "treatment",   label: "Treatment",   icon: "💊" },
  { value: "weight",      label: "Weight Check", icon: "⚖️" },
  { value: "observation", label: "Observation",  icon: "👁️" },
];

function LivestockHealthPanel({ record }: { record: FarmRecord }) {
  const [logs, setLogs] = useState<HealthEntry[]>(() => loadHealthLogs(record.id));
  const [showAdd, setShowAdd] = useState(false);
  const [type, setType] = useState<HealthEntry["type"]>("vaccination");
  const [note, setNote] = useState("");
  const [weight, setWeight] = useState("");
  const [vaccineName, setVaccineName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const handleAdd = () => {
    if (!note.trim() && !vaccineName.trim()) return;
    const entry: HealthEntry = {
      id: crypto.randomUUID(),
      date,
      type,
      note: note.trim() || vaccineName.trim(),
      weight: weight ? parseFloat(weight) : undefined,
      vaccineName: vaccineName.trim() || undefined,
    };
    const updated = [entry, ...logs];
    setLogs(updated);
    saveHealthLog(record.id, updated);
    setNote(""); setVaccineName(""); setWeight("");
    setShowAdd(false);
    toast.success("Health log entry saved!");
  };

  const handleDelete = (id: string) => {
    const updated = logs.filter(l => l.id !== id);
    setLogs(updated);
    saveHealthLog(record.id, updated);
  };

  const ENTRY_ICON: Record<string, string> = {
    vaccination: "💉", treatment: "💊", weight: "⚖️", observation: "👁️"
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-red-500" />
          <h2 className="harvest-section-title">Health Log ({logs.length})</h2>
        </div>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700"
        >
          <Plus className="h-3.5 w-3.5" /> Add Entry
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="harvest-card p-4 mb-3 space-y-3">
            <div>
              <label className="text-xs font-semibold text-foreground">Entry type</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {HEALTH_ENTRY_TYPES.map(t => (
                  <button key={t.value} onClick={() => setType(t.value as HealthEntry["type"])}
                    className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${type === t.value ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>
            {type === "vaccination" && (
              <div>
                <label className="text-xs font-semibold text-foreground">Vaccine name</label>
                <input value={vaccineName} onChange={e => setVaccineName(e.target.value)} placeholder="e.g. FMD, Newcastle" className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
              </div>
            )}
            {type === "weight" && (
              <div>
                <label className="text-xs font-semibold text-foreground">Weight (kg)</label>
                <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="e.g. 350" className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-foreground">Notes</label>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Describe what was done..." className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 rounded-xl border py-2.5 text-sm font-medium text-muted-foreground">Cancel</button>
              <button onClick={handleAdd} disabled={!note.trim() && !vaccineName.trim()} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40">Save</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {logs.length === 0 && !showAdd && (
        <p className="py-6 text-center text-sm text-muted-foreground">No health entries yet. Log vaccinations, treatments, and weight checks.</p>
      )}
      <div className="space-y-2">
        {logs.map(entry => (
          <div key={entry.id} className="harvest-card flex items-start gap-3 p-3">
            <span className="text-lg mt-0.5">{ENTRY_ICON[entry.type]}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{entry.vaccineName || entry.note}</p>
              {entry.weight && <p className="text-xs text-muted-foreground">Weight: {entry.weight} kg</p>}
              {entry.vaccineName && entry.note && <p className="text-xs text-muted-foreground">{entry.note}</p>}
              <p className="text-[11px] text-muted-foreground mt-0.5">{fmtDate(entry.date)} · {entry.type}</p>
            </div>
            <button onClick={() => handleDelete(entry.id)} className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Record Detail View ───────────────────────────────────
function RecordDetail({ record, activities, onBack, onRefresh }: {
  record: FarmRecord; activities: DbFarmActivity[]; onBack: () => void; onRefresh: () => void;
}) {
  const navigate = useNavigate();
  const [showAddAct, setShowAddAct] = useState(false);
  const [actType, setActType] = useState("irrigation");
  const [actTitle, setActTitle] = useState("");
  const [actDate, setActDate] = useState(new Date().toISOString().split("T")[0]);
  const [actNotes, setActNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const recordActs = activities.filter(a => a.farmRecordId === record.id);
  const days = daysUntil(record.expectedHarvestDate);

  const handleAddActivity = async () => {
    if (!actTitle.trim()) return;
    setSaving(true);
    try {
      await createDbFarmActivity({
        farmRecordId: record.id,
        activityType: actType,
        title: actTitle.trim(),
        notes: actNotes.trim() || undefined,
        startTime: new Date(actDate).toISOString(),
      });
      toast.success("Activity logged!");
      setShowAddAct(false);
      setActTitle(""); setActNotes("");
      onRefresh();
    } catch {
      toast.error("Could not log activity");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 py-4 space-y-5 pb-24">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground">{record.name}</h1>
          <p className="text-xs text-muted-foreground capitalize">{record.recordType} · {TYPE_CFG[record.recordType]?.label}</p>
        </div>
        <button onClick={() => navigate("/assistant")} className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10" title="Get AI advice">
          <Bot className="h-4 w-4 text-primary" />
        </button>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Crop/Type", value: record.cropType || "—" },
          { label: "Area", value: record.areaPlanted ? `${record.areaPlanted} ${record.areaUnit}` : "—" },
          { label: "Sowing date", value: fmtDate(record.sowingDate) },
          { label: "Harvest in", value: days !== null ? (days > 0 ? `${days} days` : "Due now!") : "—" },
          { label: "Expected yield", value: record.expectedYield ? `${record.expectedYield} ${record.yieldUnit}` : "—" },
          { label: "Growth stage", value: record.growthStage ? record.growthStage.charAt(0).toUpperCase() + record.growthStage.slice(1) : "—" },
        ].map(m => (
          <div key={m.label} className="harvest-card p-3">
            <p className="text-[11px] text-muted-foreground">{m.label}</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground capitalize">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Health */}
      <div className={`flex items-center gap-2 rounded-xl p-3 ${HEALTH_CFG[record.healthStatus] ?? HEALTH_CFG.healthy}`}>
        {record.healthStatus === "healthy" ? "✅" : record.healthStatus === "at_risk" ? "⚠️" : "🚨"}
        <span className="text-sm font-semibold capitalize">{record.healthStatus.replace("_", " ")}</span>
        {record.aiDiagnosisStatus !== "none" && (
          <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            AI: {record.aiDiagnosisStatus}
          </span>
        )}
      </div>

      {/* Livestock Health Panel — only for livestock/poultry */}
      {["livestock", "poultry"].includes(record.recordType) && (
        <LivestockHealthPanel record={record} />
      )}

      {/* Activities */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="harvest-section-title">Activities ({recordActs.length})</h2>
          <button
            onClick={() => setShowAddAct(v => !v)}
            className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
          >
            <Plus className="h-3.5 w-3.5" /> Log Activity
          </button>
        </div>

        {/* Inline add form */}
        <AnimatePresence>
          {showAddAct && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="harvest-card p-4 mb-3 space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground">Activity type</label>
                <select value={actType} onChange={e => setActType(e.target.value)} className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
                  {ACT_TYPES.map(t => <option key={t} value={t}>{t.replace("_", " ").charAt(0).toUpperCase() + t.replace("_", " ").slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Title *</label>
                <input value={actTitle} onChange={e => setActTitle(e.target.value)} placeholder="e.g. Applied 50kg DAP" className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Date</label>
                  <input type="date" value={actDate} onChange={e => setActDate(e.target.value)} className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Notes (optional)</label>
                  <input value={actNotes} onChange={e => setActNotes(e.target.value)} placeholder="Quantity, area..." className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowAddAct(false)} className="flex-1 rounded-xl border py-2.5 text-sm font-medium text-muted-foreground">Cancel</button>
                <button onClick={handleAddActivity} disabled={!actTitle.trim() || saving} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40">
                  {saving ? "Saving..." : "Log"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-2">
          {recordActs.length === 0 && !showAddAct && (
            <p className="py-6 text-center text-sm text-muted-foreground">No activities logged yet.</p>
          )}
          {recordActs.map(a => (
            <ActivityRow
              key={a.id}
              act={a}
              onComplete={async () => {
                await completeActivity(a.id, !a.isCompleted).catch(() => {});
                onRefresh();
              }}
              onDelete={async () => {
                await deleteDbFarmActivity(a.id).catch(() => toast.error("Could not delete"));
                onRefresh();
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────
const FarmManagement = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [view, setView] = useState<"list" | "detail">("list");
  const [selectedRecord, setSelectedRecord] = useState<FarmRecord | null>(null);
  const [records, setRecords] = useState<FarmRecord[]>([]);
  const [activities, setActivities] = useState<DbFarmActivity[]>([]);
  const [tasks, setTasks] = useState<FarmTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [showCreateRecord, setShowCreateRecord] = useState(false);
  const [tab, setTab] = useState<"records" | "tasks" | "activities">("records");
  const [generatingTasks, setGeneratingTasks] = useState(false);

  const handleGenerateSmartTasks = async () => {
    setGeneratingTasks(true);
    try {
      const count = await generateSmartTasks(records);
      if (count > 0) {
        toast.success(`${count} smart task${count !== 1 ? "s" : ""} generated!`);
        await loadData();
        setTab("tasks");
      } else {
        toast.info("No new tasks to generate right now. Check back closer to harvest dates or when health issues arise.");
      }
    } catch {
      toast.error("Could not generate tasks. Tasks table may not be set up yet.");
    } finally {
      setGeneratingTasks(false);
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [recs, acts] = await Promise.all([fetchFarmRecords(), fetchFarmActivities()]);
      setRecords(recs);
      setActivities(acts);
      setDbError(false);
    } catch {
      setDbError(true);
    }
    try {
      const tks = await fetchFarmTasks();
      setTasks(tks);
    } catch { /* tasks table might not exist yet */ }
    setLoading(false);
  }, []);

  useEffect(() => { if (isAuthenticated) loadData(); }, [isAuthenticated, loadData]);

  if (!isAuthenticated) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <Sprout className="h-12 w-12 text-muted-foreground mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Farm Management</h1>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">Sign in to track your farm activities, manage records, and get AI insights.</p>
          <button onClick={() => navigate("/login")} className="flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground">
            <LogIn className="h-4 w-4" /> Sign In
          </button>
        </div>
      </AppLayout>
    );
  }

  if (view === "detail" && selectedRecord) {
    return (
      <AppLayout>
        <RecordDetail
          record={selectedRecord}
          activities={activities}
          onBack={() => { setView("list"); setSelectedRecord(null); }}
          onRefresh={() => loadData().then(() => {
            if (selectedRecord) {
              // refresh selectedRecord with latest data
            }
          })}
        />
      </AppLayout>
    );
  }

  const activeRecs = records.filter(r => r.status === "active");
  const cropCount = activeRecs.filter(r => r.recordType === "crop").length;
  const livestockCount = activeRecs.filter(r => ["livestock","poultry","aquaculture","beekeeping"].includes(r.recordType)).length;

  const filteredRecs = activeRecs.filter(r => {
    if (typeFilter === "all") return true;
    if (typeFilter === "crops") return r.recordType === "crop";
    if (typeFilter === "livestock") return ["livestock","poultry","aquaculture","beekeeping"].includes(r.recordType);
    if (typeFilter === "equipment") return r.recordType === "equipment";
    return true;
  });

  const upcomingActs = activities
    .filter(a => !a.isCompleted)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 8);

  const pendingTasks = tasks.filter(t => !t.isCompleted).slice(0, 8);

  const yieldData = activeRecs
    .filter(r => r.recordType === "crop" && r.expectedYield)
    .map(r => ({
      name: (r.cropType || r.name).slice(0, 10),
      "Expected (kg)": r.expectedYield,
      "Actual (kg)": r.actualYield || 0,
    }));

  return (
    <AppLayout>
      <div className="space-y-5 px-4 py-4 pb-28 lg:pb-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Farm</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{activeRecs.length} active record{activeRecs.length !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={loadData} className="rounded-full p-2 bg-muted">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Crops", value: cropCount, color: "text-green-600", bg: "bg-green-50" },
            { label: "Livestock", value: livestockCount, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Activities", value: upcomingActs.length, color: "text-blue-600", bg: "bg-blue-50" },
          ].map(s => (
            <div key={s.label} className={`harvest-card p-3 text-center ${s.bg}`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* DB error banner */}
        {dbError && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Database setup required</p>
              <p className="mt-1 text-xs text-amber-700">Run <code className="rounded bg-amber-200 px-1">farm_schema.sql</code> in your Supabase SQL editor to enable farm management.</p>
            </div>
          </div>
        )}

        {/* AI assistant shortcut */}
        <button onClick={() => navigate("/assistant")} className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left hover:bg-muted/50 transition-colors">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">AI Farm Assistant</p>
            <p className="text-[11px] text-muted-foreground">Diagnose diseases, get advice, plan activities</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Tab selector */}
        <div className="flex rounded-xl bg-muted p-1">
          {(["records", "activities", "tasks"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold capitalize transition-colors ${tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              {t === "records" ? "📋 Records" : t === "activities" ? "📅 Activities" : "✅ Tasks"}
            </button>
          ))}
        </div>

        {/* Records tab */}
        {tab === "records" && (
          <div className="space-y-4">
            {/* Type filter */}
            <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4">
              {[["all","All"],["crops","Crops"],["livestock","Livestock"],["equipment","Equipment"]].map(([v, l]) => (
                <button key={v} onClick={() => setTypeFilter(v)}
                  className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${typeFilter === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}>
                  {l}
                </button>
              ))}
            </div>

            {loading && <div className="py-12 text-center text-sm text-muted-foreground">Loading your farm data…</div>}

            {!loading && !dbError && filteredRecs.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Sprout className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">No records yet</p>
                <p className="text-xs text-muted-foreground">Add your first farm record to get started</p>
                <button onClick={() => setShowCreateRecord(true)} className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground">
                  + Add Record
                </button>
              </div>
            )}

            <div className="space-y-3">
              {filteredRecs.map((r, i) => (
                <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <RecordCard
                    record={r}
                    onClick={() => { setSelectedRecord(r); setView("detail"); }}
                    onDelete={async () => {
                      await deleteFarmRecord(r.id).catch(() => toast.error("Could not delete"));
                      loadData();
                    }}
                  />
                </motion.div>
              ))}
            </div>

            {/* Yield chart */}
            {yieldData.length > 0 && (
              <div className="harvest-card p-4">
                <div className="mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <h2 className="harvest-section-title">Yield Forecast</h2>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={yieldData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="Expected (kg)" fill="hsl(var(--primary))" opacity={0.4} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Actual (kg)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Activities tab */}
        {tab === "activities" && (
          <div className="space-y-2">
            {upcomingActs.length === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground">No upcoming activities. Open a farm record to log activities.</p>
            )}
            {upcomingActs.map(a => (
              <ActivityRow
                key={a.id}
                act={a}
                onComplete={async () => {
                  await completeActivity(a.id, !a.isCompleted).catch(() => {});
                  loadData();
                }}
                onDelete={async () => {
                  await deleteDbFarmActivity(a.id).catch(() => toast.error("Could not delete"));
                  loadData();
                }}
              />
            ))}
          </div>
        )}

        {/* Tasks tab */}
        {tab === "tasks" && (
          <div className="space-y-2">
            {/* Smart task generation */}
            <button
              onClick={handleGenerateSmartTasks}
              disabled={generatingTasks || records.length === 0}
              className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-3 text-left transition-colors hover:bg-primary/10 disabled:opacity-40"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                {generatingTasks ? (
                  <RefreshCw className="h-4 w-4 text-primary animate-spin" />
                ) : (
                  <Bell className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-foreground">
                  {generatingTasks ? "Generating tasks..." : "Generate Smart Tasks"}
                </p>
                <p className="text-[10px] text-muted-foreground">AI creates tasks from your farm records</p>
              </div>
            </button>

            {pendingTasks.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <ClipboardList className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">No pending tasks</p>
                <p className="text-xs text-muted-foreground">Use "Generate Smart Tasks" above or add farm records with harvest dates</p>
              </div>
            )}
            {pendingTasks.map(t => (
              <TaskRow
                key={t.id}
                task={t}
                onComplete={async () => {
                  await completeTask(t.id).catch(() => {});
                  loadData();
                }}
                onDelete={async () => {
                  await deleteTask(t.id).catch(() => toast.error("Could not delete"));
                  loadData();
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <motion.button
        onClick={() => setShowCreateRecord(true)}
        whileTap={{ scale: 0.92 }}
        className="fixed bottom-20 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg text-primary-foreground lg:bottom-6 lg:right-8"
      >
        <Plus className="h-6 w-6" />
      </motion.button>

      <CreateFarmRecordSheet
        open={showCreateRecord}
        onClose={() => setShowCreateRecord(false)}
        onCreated={() => loadData()}
      />
    </AppLayout>
  );
};

export default FarmManagement;
