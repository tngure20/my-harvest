import { useState } from "react";
import { X, Wheat, Beef, Fish, Hexagon, Wrench, Plus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { createFarmRecord, type FarmRecord } from "@/services/farmService";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (record: FarmRecord) => void;
}

const TYPES = [
  { id: "crop",        label: "Crop",       emoji: "🌾", icon: Wheat,   color: "bg-green-100 text-green-700" },
  { id: "livestock",   label: "Livestock",  emoji: "🐄", icon: Beef,    color: "bg-amber-100 text-amber-700" },
  { id: "poultry",     label: "Poultry",    emoji: "🐔", icon: Beef,    color: "bg-orange-100 text-orange-700" },
  { id: "aquaculture", label: "Fish Pond",  emoji: "🐟", icon: Fish,    color: "bg-blue-100 text-blue-700" },
  { id: "beekeeping",  label: "Beekeeping", emoji: "🐝", icon: Hexagon, color: "bg-yellow-100 text-yellow-700" },
  { id: "equipment",   label: "Equipment",  emoji: "🚜", icon: Wrench,  color: "bg-gray-100 text-gray-700" },
];

const GROWTH_STAGES = ["germination", "seedling", "vegetative", "flowering", "fruiting", "harvest"];

const today = new Date().toISOString().split("T")[0];

function addDays(base: string, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

const DEFAULT_HARVEST_DAYS: Record<string, number> = {
  crop: 120, livestock: 365, poultry: 84, aquaculture: 180, beekeeping: 90, equipment: 0,
};

const CreateFarmRecordSheet = ({ open, onClose, onCreated }: Props) => {
  const [step, setStep] = useState<"type" | "details">("type");
  const [recordType, setRecordType] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cropType, setCropType] = useState("");
  const [areaPlanted, setAreaPlanted] = useState("");
  const [areaUnit, setAreaUnit] = useState("acres");
  const [growthStage, setGrowthStage] = useState("germination");
  const [sowingDate, setSowingDate] = useState(today);
  const [expectedHarvestDate, setExpectedHarvestDate] = useState("");
  const [expectedYield, setExpectedYield] = useState("");
  const [yieldUnit, setYieldUnit] = useState("kg");
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setStep("type"); setRecordType(""); setName(""); setDescription("");
    setCropType(""); setAreaPlanted(""); setAreaUnit("acres");
    setGrowthStage("germination"); setSowingDate(today);
    setExpectedHarvestDate(""); setExpectedYield(""); setYieldUnit("kg");
  };

  const handleTypeSelect = (type: string) => {
    setRecordType(type);
    setExpectedHarvestDate(addDays(today, DEFAULT_HARVEST_DAYS[type] ?? 120));
    setStep("details");
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const record = await createFarmRecord({
        name: name.trim(),
        description: description.trim() || undefined,
        recordType,
        cropType: cropType.trim() || undefined,
        areaPlanted: areaPlanted ? parseFloat(areaPlanted) : undefined,
        areaUnit,
        growthStage: recordType === "crop" ? growthStage : undefined,
        sowingDate: sowingDate || undefined,
        expectedHarvestDate: expectedHarvestDate || undefined,
        expectedYield: expectedYield ? parseFloat(expectedYield) : undefined,
        yieldUnit,
      });
      toast.success("Farm record created!");
      onCreated(record);
      reset();
      onClose();
    } catch {
      toast.error("Could not save record. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const typeInfo = TYPES.find(t => t.id === recordType);
  const isCrop = recordType === "crop";
  const isLivestock = ["livestock", "poultry"].includes(recordType);
  const isAqua = recordType === "aquaculture";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm"
            onClick={() => { reset(); onClose(); }}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-2xl bg-card shadow-xl"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-5 py-4">
              <div className="flex items-center gap-2">
                {step === "details" && (
                  <button onClick={() => setStep("type")} className="text-xs font-medium text-primary">← Back</button>
                )}
                <h2 className="font-display text-lg font-bold text-foreground">
                  {step === "type" ? "What are you farming?" : `New ${typeInfo?.label ?? ""} Record`}
                </h2>
              </div>
              <button onClick={() => { reset(); onClose(); }} className="rounded-full bg-muted p-1.5">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="p-5">
              {step === "type" ? (
                <div className="grid grid-cols-3 gap-3">
                  {TYPES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleTypeSelect(t.id)}
                      className="flex flex-col items-center gap-2 rounded-2xl border-2 border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-sm active:scale-95"
                    >
                      <span className="text-3xl">{t.emoji}</span>
                      <span className="text-xs font-semibold text-foreground">{t.label}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Name */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">Record name *</label>
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder={
                        isCrop ? "e.g. Maize Field — Block B" :
                        isLivestock ? "e.g. Dairy herd — Homa Bay" :
                        isAqua ? "e.g. Tilapia pond 1" :
                        "e.g. North apiary"
                      }
                      autoFocus
                      className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  {/* Crop / animal type */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      {isCrop ? "Crop variety" : isAqua ? "Fish species" : "Animal breed / species"}
                    </label>
                    <input
                      value={cropType}
                      onChange={e => setCropType(e.target.value)}
                      placeholder={
                        isCrop ? "e.g. Maize H614D" :
                        isLivestock ? "e.g. Friesian cattle" :
                        isAqua ? "e.g. Nile Tilapia" :
                        "e.g. African honeybee"
                      }
                      className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  {/* Area + unit */}
                  {recordType !== "equipment" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-foreground">
                          {isLivestock ? "Number of animals" : isAqua ? "Pond size" : "Area planted"}
                        </label>
                        <input
                          value={areaPlanted}
                          onChange={e => setAreaPlanted(e.target.value)}
                          type="number"
                          min="0"
                          placeholder="0"
                          className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-foreground">Unit</label>
                        <select
                          value={areaUnit}
                          onChange={e => setAreaUnit(e.target.value)}
                          className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                        >
                          {isLivestock ? (
                            <option value="head">head</option>
                          ) : isAqua ? (
                            <>
                              <option value="m²">m²</option>
                              <option value="acres">acres</option>
                            </>
                          ) : (
                            <>
                              <option value="acres">acres</option>
                              <option value="hectares">hectares</option>
                            </>
                          )}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-foreground">
                        {isCrop ? "Sowing date" : "Start date"}
                      </label>
                      <input
                        type="date"
                        value={sowingDate}
                        onChange={e => setSowingDate(e.target.value)}
                        className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-foreground">Expected harvest</label>
                      <input
                        type="date"
                        value={expectedHarvestDate}
                        onChange={e => setExpectedHarvestDate(e.target.value)}
                        className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>

                  {/* Growth stage (crops only) */}
                  {isCrop && (
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-foreground">Current growth stage</label>
                      <div className="flex flex-wrap gap-2">
                        {GROWTH_STAGES.map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setGrowthStage(s)}
                            className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
                              growthStage === s
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-card text-foreground border-border hover:bg-muted"
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Expected yield */}
                  {recordType !== "equipment" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-foreground">Expected yield</label>
                        <input
                          value={expectedYield}
                          onChange={e => setExpectedYield(e.target.value)}
                          type="number"
                          min="0"
                          placeholder="0"
                          className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-foreground">Unit</label>
                        <select
                          value={yieldUnit}
                          onChange={e => setYieldUnit(e.target.value)}
                          className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="kg">kg</option>
                          <option value="bags">bags</option>
                          <option value="tonnes">tonnes</option>
                          <option value="litres">litres</option>
                          <option value="pieces">pieces</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">Notes (optional)</label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Location, soil type, anything relevant..."
                      rows={2}
                      className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={!name.trim() || loading}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
                  >
                    {loading
                      ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                      : <Plus className="h-4 w-4" />}
                    {loading ? "Saving..." : "Create Record"}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CreateFarmRecordSheet;
