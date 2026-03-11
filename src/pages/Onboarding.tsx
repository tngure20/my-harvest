import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Leaf, ArrowRight, ArrowLeft, MapPin, Check } from "lucide-react";
import OnboardingStepWrapper from "@/components/onboarding/OnboardingStepWrapper";
import FollowUpSteps from "@/components/onboarding/FollowUpSteps";
import { farmingTypes, farmScales, defaultOnboardingData, type OnboardingData } from "@/components/onboarding/onboardingData";

const Onboarding = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<OnboardingData>(defaultOnboardingData);
  const [stepIndex, setStepIndex] = useState(0);

  // Dynamic steps based on selected farming types
  const steps = useMemo(() => {
    const base = [
      { id: "welcome", title: "Welcome to Harvest", subtitle: "Let's personalize your experience" },
      { id: "name", title: "What's your name?", subtitle: "We'll use this across the platform" },
      { id: "location", title: "Where are you located?", subtitle: "For localized weather and market info" },
      { id: "types", title: "What do you farm?", subtitle: "Select all that apply" },
    ];

    // Insert follow-up steps for each selected farming type
    const followUps = data.selectedTypes
      .filter((t) => ["livestock", "poultry", "crop", "fruit", "aquaculture", "beekeeping"].includes(t))
      .map((t) => {
        const type = farmingTypes.find((ft) => ft.id === t);
        return {
          id: `followup-${t}`,
          title: `${type?.emoji} ${type?.label} Details`,
          subtitle: "Tell us more to personalize your experience",
        };
      });

    return [
      ...base,
      ...followUps,
      { id: "scale", title: "What's your farm scale?", subtitle: "This helps us tailor our tools" },
      { id: "done", title: "You're all set! 🎉", subtitle: "Welcome to the Harvest community" },
    ];
  }, [data.selectedTypes]);

  const currentStep = steps[stepIndex];

  const canProceed = () => {
    if (!currentStep) return false;
    switch (currentStep.id) {
      case "name": return data.name.trim().length > 0;
      case "location": return data.location.trim().length > 0;
      case "types": return data.selectedTypes.length > 0;
      case "scale": return data.selectedScale.length > 0;
      case "followup-livestock":
        return data.livestockAnimals.length > 0;
      case "followup-poultry":
        return data.poultryBirds.length > 0;
      case "followup-crop":
        return data.crops.length > 0;
      case "followup-fruit":
        return data.fruits.length > 0;
      case "followup-aquaculture":
        return data.fishSpecies.length > 0;
      case "followup-beekeeping":
        return data.hiveCount.trim().length > 0;
      default: return true;
    }
  };

  const next = () => {
    if (stepIndex === steps.length - 1) {
      navigate("/");
      return;
    }
    setStepIndex((s) => Math.min(s + 1, steps.length - 1));
  };

  const back = () => setStepIndex((s) => Math.max(s - 1, 0));

  const toggleType = (id: string) => {
    setData((prev) => ({
      ...prev,
      selectedTypes: prev.selectedTypes.includes(id)
        ? prev.selectedTypes.filter((t) => t !== id)
        : [...prev.selectedTypes, id],
    }));
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Progress */}
      <div className="px-4 pt-4">
        <div className="flex gap-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= stepIndex ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-6 py-8">
        <AnimatePresence mode="wait">
          <OnboardingStepWrapper key={currentStep.id} title={currentStep.title} subtitle={currentStep.subtitle}>
            {currentStep.id === "welcome" && (
              <div className="flex flex-col items-center justify-center gap-6 py-12">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary">
                  <Leaf className="h-10 w-10 text-primary-foreground" />
                </div>
                <p className="max-w-xs text-center text-sm text-muted-foreground leading-relaxed">
                  Harvest connects you with farmers, experts, weather data, markets, and tools — all in one place.
                </p>
              </div>
            )}

            {currentStep.id === "name" && (
              <div>
                <label className="text-sm font-medium text-foreground">Your name</label>
                <input
                  value={data.name}
                  onChange={(e) => setData((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Jane Wanjiku"
                  className="mt-2 w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}

            {currentStep.id === "location" && (
              <div>
                <label className="text-sm font-medium text-foreground">Your location</label>
                <div className="relative mt-2">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    value={data.location}
                    onChange={(e) => setData((p) => ({ ...p, location: e.target.value }))}
                    placeholder="e.g. Nakuru, Kenya"
                    className="w-full rounded-xl border bg-card py-3 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <button className="mt-2 text-xs font-medium text-primary">📍 Detect my location</button>
              </div>
            )}

            {currentStep.id === "types" && (
              <div className="grid grid-cols-2 gap-3">
                {farmingTypes.map((type) => {
                  const selected = data.selectedTypes.includes(type.id);
                  return (
                    <button
                      key={type.id}
                      onClick={() => toggleType(type.id)}
                      className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                        selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"
                      }`}
                    >
                      {selected && (
                        <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}
                      <span className="text-2xl">{type.emoji}</span>
                      <span className="text-xs font-medium text-foreground">{type.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {currentStep.id.startsWith("followup-") && (
              <FollowUpSteps
                data={data}
                setData={setData}
                activityType={currentStep.id.replace("followup-", "")}
              />
            )}

            {currentStep.id === "scale" && (
              <div className="space-y-3">
                {farmScales.map((scale) => (
                  <button
                    key={scale.id}
                    onClick={() => setData((p) => ({ ...p, selectedScale: scale.id }))}
                    className={`flex w-full items-center gap-3 rounded-xl border-2 p-4 transition-all ${
                      data.selectedScale === scale.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/30"
                    }`}
                  >
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-foreground">{scale.label}</p>
                      <p className="text-xs text-muted-foreground">{scale.desc}</p>
                    </div>
                    {data.selectedScale === scale.id && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {currentStep.id === "done" && (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="text-5xl">🌾</div>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                  Your personalized farming dashboard is ready. Connect with farmers, check weather, and grow smarter.
                </p>
              </div>
            )}
          </OnboardingStepWrapper>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-6">
          {stepIndex > 0 ? (
            <button onClick={back} className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={next}
            disabled={!canProceed()}
            className="flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-40"
          >
            {stepIndex === steps.length - 1 ? "Get Started" : "Continue"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
