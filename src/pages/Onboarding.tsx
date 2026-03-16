import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Leaf, ArrowRight, ArrowLeft, MapPin, Check, Globe, ChevronDown } from "lucide-react";
import OnboardingStepWrapper from "@/components/onboarding/OnboardingStepWrapper";
import FollowUpSteps from "@/components/onboarding/FollowUpSteps";
import { farmingTypes, farmScales, defaultOnboardingData, type OnboardingData } from "@/components/onboarding/onboardingData";
import { kenyanCounties, countries, type LocationData } from "@/components/onboarding/locationData";
import { useAuth } from "@/contexts/AuthContext";
import { updateProfile } from "@/lib/supabaseService";

const Onboarding = () => {
  const navigate = useNavigate();
  const { user, updateUser, setOnboardingComplete } = useAuth();
  const [data, setData] = useState<OnboardingData>({
    ...defaultOnboardingData,
    name: user?.name || "",
  });
  const [stepIndex, setStepIndex] = useState(0);
  const [locationData, setLocationData] = useState<LocationData>({
    country: "KE",
    countryCode: "KE",
    region: "",
  });

  const steps = useMemo(() => {
    const base = [
      { id: "welcome", title: "Welcome to Harvest", subtitle: "Let's personalize your experience" },
      { id: "location", title: "Where are you located?", subtitle: "For localized weather and market info" },
      { id: "types", title: "What do you farm?", subtitle: "Select all that apply" },
    ];

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
  const isLastStep = stepIndex === steps.length - 1;

  const finish = async () => {
    const country = countries.find(c => c.id === locationData.countryCode);
    const locationString = locationData.region
      ? `${locationData.region}, ${country?.name.replace(/\s.+$/, '') || locationData.countryCode}`
      : country?.name.replace(/\s.+$/, '') || "";

    if (user) {
      const updates = {
        location: locationString || user.location,
        farmingActivities: data.selectedTypes.length > 0 ? data.selectedTypes : user.farmingActivities,
      };
      updateUser(updates);
      await updateProfile(user.id, {
        location: locationString || user.location || undefined,
        farming_types: data.selectedTypes.length > 0 ? data.selectedTypes : undefined,
        farm_scale: data.selectedScale || undefined,
        onboarding_completed: true,
      }).catch(() => {});
    }

    setOnboardingComplete();
    navigate("/");
  };

  const next = () => {
    if (isLastStep) { finish(); return; }
    setStepIndex((s) => Math.min(s + 1, steps.length - 1));
  };

  const skip = () => {
    if (isLastStep) { finish(); return; }
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

  const selectedCountry = countries.find(c => c.id === locationData.countryCode);

  return (
    <div className="flex min-h-screen flex-col bg-background">
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
                <p className="text-xs text-muted-foreground">All questions are optional — skip any time</p>
              </div>
            )}

            {currentStep.id === "location" && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    <Globe className="mr-1 inline h-4 w-4" /> Country
                  </label>
                  <div className="relative">
                    <select
                      value={locationData.countryCode}
                      onChange={(e) => setLocationData({ country: e.target.value, countryCode: e.target.value, region: "" })}
                      className="w-full appearance-none rounded-xl border bg-card px-4 py-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary"
                    >
                      {countries.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    <MapPin className="mr-1 inline h-4 w-4" /> {selectedCountry?.regionLabel || "Region"}
                  </label>
                  {locationData.countryCode === "KE" ? (
                    <div className="relative">
                      <select
                        value={locationData.region}
                        onChange={(e) => setLocationData(prev => ({ ...prev, region: e.target.value }))}
                        className="w-full appearance-none rounded-xl border bg-card px-4 py-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">Select county...</option>
                        {kenyanCounties.map((county) => (
                          <option key={county} value={county}>{county}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                    </div>
                  ) : (
                    <input
                      value={locationData.region}
                      onChange={(e) => setLocationData(prev => ({ ...prev, region: e.target.value }))}
                      placeholder={`Enter your ${selectedCountry?.regionLabel?.toLowerCase() || "region"}`}
                      className="w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                    />
                  )}
                </div>
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

        <div className="flex items-center justify-between pt-6">
          {stepIndex > 0 ? (
            <button onClick={back} className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            {currentStep.id !== "welcome" && currentStep.id !== "done" && (
              <button
                onClick={skip}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Skip
              </button>
            )}
            <button
              onClick={next}
              className="flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-opacity"
            >
              {isLastStep ? "Get Started" : "Continue"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
