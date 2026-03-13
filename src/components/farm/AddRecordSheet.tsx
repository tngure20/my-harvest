import { useState } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface AddRecordSheetProps {
  open: boolean;
  onClose: () => void;
  activityType: string;
  onAdd: (record: { type: string; description: string; date: string; quantity?: string }) => void;
}

const recordTypesByActivity: Record<string, string[]> = {
  crop: ["Planting", "Fertilizer Application", "Pesticide Spray", "Weeding", "Irrigation", "Pest Sighting", "Disease Observed", "Harvest", "Soil Test", "Other"],
  livestock: ["Vaccination", "Deworming", "Feed Change", "Illness", "Treatment", "Birth", "Death", "Sale", "Weight Check", "Other"],
  poultry: ["Vaccination", "Feed Change", "Egg Collection", "Mortality", "Medication", "Debeaking", "Sale", "Other"],
  aquaculture: ["Feeding", "Water Test", "Fish Sampling", "Mortality", "Pond Treatment", "Harvest", "Stocking", "Other"],
  beekeeping: ["Hive Inspection", "Honey Harvest", "Pest Check", "Colony Split", "Feeding", "Queen Check", "Other"],
};

const AddRecordSheet = ({ open, onClose, activityType, onAdd }: AddRecordSheetProps) => {
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [quantity, setQuantity] = useState("");

  const types = recordTypesByActivity[activityType] || recordTypesByActivity.crop;

  const reset = () => { setType(""); setDescription(""); setDate(new Date().toISOString().split("T")[0]); setQuantity(""); };

  const handleSubmit = () => {
    if (!type || !description.trim()) return;
    onAdd({ type, description: description.trim(), date, quantity: quantity.trim() || undefined });
    reset();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm" onClick={() => { onClose(); reset(); }} />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-card p-5 shadow-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-foreground">Log Farm Record</h2>
              <button onClick={() => { onClose(); reset(); }} className="rounded-full bg-muted p-1.5">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Record type</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {types.map((t) => (
                    <button
                      key={t}
                      onClick={() => setType(t)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                        type === t ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Applied 50kg DAP fertilizer on Block A"
                  rows={3}
                  className="mt-1 w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-foreground">Date</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Quantity (optional)</label>
                  <input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 50 kg" className="mt-1 w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => { onClose(); reset(); }} className="flex-1 rounded-xl border py-3 text-sm font-medium text-muted-foreground">Cancel</button>
                <button onClick={handleSubmit} disabled={!type || !description.trim()} className="flex-1 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-40">Save Record</button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AddRecordSheet;
