import { useState } from "react";
import { X, Wheat, Fish, Hexagon } from "lucide-react";
import { Bug as Cow } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { FarmActivity, FarmTask } from "@/pages/FarmManagement";

interface CreateActivitySheetProps {
  open: boolean;
  onClose: () => void;
  onAdd: (activity: FarmActivity) => void;
}

const activityTypes = [
  { id: "crop" as const, label: "Crop Field", emoji: "🌾", icon: Wheat },
  { id: "livestock" as const, label: "Livestock Herd", emoji: "🐄", icon: Cow },
  { id: "aquaculture" as const, label: "Fish Pond", emoji: "🐟", icon: Fish },
  { id: "beekeeping" as const, label: "Beehives", emoji: "🐝", icon: Hexagon },
];

function generateTasks(type: string, startDate: string): FarmTask[] {
  const d = new Date(startDate);
  const addDays = (days: number) => {
    const nd = new Date(d);
    nd.setDate(nd.getDate() + days);
    return nd.toISOString().split("T")[0];
  };

  switch (type) {
    case "crop":
      return [
        { id: crypto.randomUUID(), title: "Germination check", dueDate: addDays(14), completed: false, category: "Monitoring" },
        { id: crypto.randomUUID(), title: "First fertilizer application", dueDate: addDays(21), completed: false, category: "Fertilizer" },
        { id: crypto.randomUUID(), title: "Pest scouting", dueDate: addDays(30), completed: false, category: "Pest Control" },
        { id: crypto.randomUUID(), title: "Weeding", dueDate: addDays(42), completed: false, category: "Maintenance" },
        { id: crypto.randomUUID(), title: "Top dressing fertilizer", dueDate: addDays(45), completed: false, category: "Fertilizer" },
        { id: crypto.randomUUID(), title: "Estimated harvest", dueDate: addDays(120), completed: false, category: "Harvest" },
      ];
    case "livestock":
      return [
        { id: crypto.randomUUID(), title: "Vaccination schedule", dueDate: addDays(7), completed: false, category: "Health" },
        { id: crypto.randomUUID(), title: "Deworming", dueDate: addDays(30), completed: false, category: "Health" },
        { id: crypto.randomUUID(), title: "Breeding check", dueDate: addDays(14), completed: false, category: "Breeding" },
        { id: crypto.randomUUID(), title: "Hoof trimming", dueDate: addDays(60), completed: false, category: "Maintenance" },
      ];
    case "aquaculture":
      return [
        { id: crypto.randomUUID(), title: "Water quality test", dueDate: addDays(7), completed: false, category: "Monitoring" },
        { id: crypto.randomUUID(), title: "Feeding schedule review", dueDate: addDays(14), completed: false, category: "Feeding" },
        { id: crypto.randomUUID(), title: "Growth sampling", dueDate: addDays(30), completed: false, category: "Monitoring" },
        { id: crypto.randomUUID(), title: "Estimated harvest", dueDate: addDays(180), completed: false, category: "Harvest" },
      ];
    case "beekeeping":
      return [
        { id: crypto.randomUUID(), title: "Hive inspection", dueDate: addDays(14), completed: false, category: "Monitoring" },
        { id: crypto.randomUUID(), title: "Pest check (varroa mites)", dueDate: addDays(21), completed: false, category: "Pest Control" },
        { id: crypto.randomUUID(), title: "Honey harvesting", dueDate: addDays(90), completed: false, category: "Harvest" },
      ];
    default:
      return [];
  }
}

const CreateActivitySheet = ({ open, onClose, onAdd }: CreateActivitySheetProps) => {
  const [type, setType] = useState<FarmActivity["type"] | null>(null);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [size, setSize] = useState("");
  const [species, setSpecies] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);

  const reset = () => {
    setType(null);
    setName("");
    setLocation("");
    setSize("");
    setSpecies("");
    setStartDate(new Date().toISOString().split("T")[0]);
  };

  const handleSubmit = () => {
    if (!type || !name.trim()) return;
    const activity: FarmActivity = {
      id: crypto.randomUUID(),
      type,
      name: name.trim(),
      location: location.trim() || "Not specified",
      size: size.trim() || "Not specified",
      species: species.trim() || "Not specified",
      startDate,
      tasks: generateTasks(type, startDate),
      records: [],
    };
    onAdd(activity);
    reset();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm"
            onClick={() => { onClose(); reset(); }}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-2xl bg-card p-5 shadow-lg"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-bold text-foreground">New Farm Activity</h2>
              <button onClick={() => { onClose(); reset(); }} className="rounded-full bg-muted p-1.5">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {!type ? (
              <div className="grid grid-cols-2 gap-3">
                {activityTypes.map((at) => (
                  <button
                    key={at.id}
                    onClick={() => setType(at.id)}
                    className="flex flex-col items-center gap-2 rounded-xl border-2 border-border bg-card p-4 transition-all hover:border-primary/30"
                  >
                    <span className="text-2xl">{at.emoji}</span>
                    <span className="text-xs font-medium text-foreground">{at.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Activity name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Maize Field - Block B"
                    className="mt-1 w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Species / Crop type</label>
                  <input
                    value={species}
                    onChange={(e) => setSpecies(e.target.value)}
                    placeholder={type === "crop" ? "e.g. Maize H614D" : type === "livestock" ? "e.g. Friesian cattle" : "e.g. Tilapia"}
                    className="mt-1 w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-foreground">Location</label>
                    <input
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Nakuru"
                      className="mt-1 w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Size</label>
                    <input
                      value={size}
                      onChange={(e) => setSize(e.target.value)}
                      placeholder={type === "livestock" ? "e.g. 20 head" : "e.g. 2 acres"}
                      className="mt-1 w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Start date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setType(null)}
                    className="flex-1 rounded-xl border py-3 text-sm font-medium text-muted-foreground"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!name.trim()}
                    className="flex-1 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-40"
                  >
                    Create Activity
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CreateActivitySheet;
