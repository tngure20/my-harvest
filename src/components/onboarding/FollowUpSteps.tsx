import { Check } from "lucide-react";
import { OnboardingData, livestockAnimals, livestockPurposes, poultryBirds, poultryFocus, crops, fruits, fishSpecies } from "./onboardingData";

interface FollowUpStepsProps {
  data: OnboardingData;
  setData: React.Dispatch<React.SetStateAction<OnboardingData>>;
  activityType: string;
}

const MultiSelect = ({
  items,
  selected,
  onToggle,
}: {
  items: { id: string; label: string; emoji?: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) => (
  <div className="grid grid-cols-2 gap-3">
    {items.map((item) => {
      const isSelected = selected.includes(item.id);
      return (
        <button
          key={item.id}
          onClick={() => onToggle(item.id)}
          className={`relative flex items-center gap-2 rounded-xl border-2 p-3 transition-all ${
            isSelected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"
          }`}
        >
          {isSelected && (
            <div className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
              <Check className="h-2.5 w-2.5 text-primary-foreground" />
            </div>
          )}
          {item.emoji && <span className="text-lg">{item.emoji}</span>}
          <span className="text-xs font-medium text-foreground">{item.label}</span>
        </button>
      );
    })}
  </div>
);

const SingleSelect = ({
  items,
  selected,
  onSelect,
}: {
  items: { id: string; label: string }[];
  selected: string;
  onSelect: (id: string) => void;
}) => (
  <div className="flex flex-wrap gap-2">
    {items.map((item) => (
      <button
        key={item.id}
        onClick={() => onSelect(item.id)}
        className={`rounded-full border-2 px-4 py-2 text-sm font-medium transition-all ${
          selected === item.id
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-card text-foreground hover:border-primary/30"
        }`}
      >
        {item.label}
      </button>
    ))}
  </div>
);

const NumberInput = ({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
}) => (
  <div className="mt-4">
    <label className="text-sm font-medium text-foreground">{label}</label>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      type="number"
      min="0"
      className="mt-2 w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
    />
  </div>
);

const toggleInArray = (arr: string[], id: string) =>
  arr.includes(id) ? arr.filter((i) => i !== id) : [...arr, id];

const FollowUpSteps = ({ data, setData, activityType }: FollowUpStepsProps) => {
  const update = (partial: Partial<OnboardingData>) => setData((prev) => ({ ...prev, ...partial }));

  if (activityType === "livestock") {
    return (
      <div className="space-y-6">
        <div>
          <p className="mb-3 text-sm font-medium text-foreground">What animals do you raise?</p>
          <MultiSelect
            items={livestockAnimals}
            selected={data.livestockAnimals}
            onToggle={(id) => update({ livestockAnimals: toggleInArray(data.livestockAnimals, id) })}
          />
        </div>
        <NumberInput
          label="Approximate herd size"
          value={data.livestockHerdSize}
          onChange={(val) => update({ livestockHerdSize: val })}
          placeholder="e.g. 25"
        />
        <div>
          <p className="mb-3 text-sm font-medium text-foreground">Primary purpose</p>
          <SingleSelect
            items={livestockPurposes}
            selected={data.livestockPurpose}
            onSelect={(id) => update({ livestockPurpose: id })}
          />
        </div>
      </div>
    );
  }

  if (activityType === "poultry") {
    return (
      <div className="space-y-6">
        <div>
          <p className="mb-3 text-sm font-medium text-foreground">What birds do you keep?</p>
          <MultiSelect
            items={poultryBirds}
            selected={data.poultryBirds}
            onToggle={(id) => update({ poultryBirds: toggleInArray(data.poultryBirds, id) })}
          />
        </div>
        <NumberInput
          label="Approximate flock size"
          value={data.poultryFlockSize}
          onChange={(val) => update({ poultryFlockSize: val })}
          placeholder="e.g. 200"
        />
        <div>
          <p className="mb-3 text-sm font-medium text-foreground">Production focus</p>
          <SingleSelect
            items={poultryFocus}
            selected={data.poultryFocus}
            onSelect={(id) => update({ poultryFocus: id })}
          />
        </div>
      </div>
    );
  }

  if (activityType === "crop") {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-foreground">Which crops do you grow?</p>
        <MultiSelect
          items={crops}
          selected={data.crops}
          onToggle={(id) => update({ crops: toggleInArray(data.crops, id) })}
        />
      </div>
    );
  }

  if (activityType === "fruit") {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-foreground">Which fruits do you grow?</p>
        <MultiSelect
          items={fruits}
          selected={data.fruits}
          onToggle={(id) => update({ fruits: toggleInArray(data.fruits, id) })}
        />
      </div>
    );
  }

  if (activityType === "aquaculture") {
    return (
      <div className="space-y-6">
        <div>
          <p className="mb-3 text-sm font-medium text-foreground">Which fish species do you farm?</p>
          <MultiSelect
            items={fishSpecies}
            selected={data.fishSpecies}
            onToggle={(id) => update({ fishSpecies: toggleInArray(data.fishSpecies, id) })}
          />
        </div>
        <NumberInput
          label="Number of ponds/tanks"
          value={data.fishPondCount}
          onChange={(val) => update({ fishPondCount: val })}
          placeholder="e.g. 4"
        />
      </div>
    );
  }

  if (activityType === "beekeeping") {
    return (
      <div className="space-y-4">
        <NumberInput
          label="Number of hives"
          value={data.hiveCount}
          onChange={(val) => update({ hiveCount: val })}
          placeholder="e.g. 10"
        />
      </div>
    );
  }

  return null;
};

export default FollowUpSteps;
