export const farmingTypes = [
  { id: "livestock", label: "Livestock Farming", emoji: "🐄" },
  { id: "crop", label: "Crop Farming", emoji: "🌾" },
  { id: "poultry", label: "Poultry Farming", emoji: "🐔" },
  { id: "fruit", label: "Fruit Farming", emoji: "🥭" },
  { id: "aquaculture", label: "Aquaculture", emoji: "🐟" },
  { id: "beekeeping", label: "Beekeeping", emoji: "🐝" },
  { id: "mixed", label: "Mixed Farming", emoji: "🌿" },
];

export const farmScales = [
  { id: "garden", label: "Home Garden", desc: "Growing for personal/family use" },
  { id: "small", label: "Small Farm", desc: "Less than 5 acres" },
  { id: "medium", label: "Medium Farm", desc: "5–50 acres" },
  { id: "large", label: "Large Scale", desc: "Over 50 acres" },
];

export const livestockAnimals = [
  { id: "cattle", label: "Cattle", emoji: "🐄" },
  { id: "goats", label: "Goats", emoji: "🐐" },
  { id: "sheep", label: "Sheep", emoji: "🐑" },
  { id: "pigs", label: "Pigs", emoji: "🐷" },
  { id: "donkeys", label: "Donkeys", emoji: "🫏" },
  { id: "camels", label: "Camels", emoji: "🐪" },
];

export const livestockPurposes = [
  { id: "dairy", label: "Dairy" },
  { id: "meat", label: "Meat" },
  { id: "breeding", label: "Breeding" },
  { id: "mixed", label: "Mixed" },
];

export const poultryBirds = [
  { id: "chickens", label: "Chickens", emoji: "🐔" },
  { id: "ducks", label: "Ducks", emoji: "🦆" },
  { id: "turkeys", label: "Turkeys", emoji: "🦃" },
  { id: "quails", label: "Quails", emoji: "🐦" },
];

export const poultryFocus = [
  { id: "eggs", label: "Eggs" },
  { id: "meat", label: "Meat" },
  { id: "both", label: "Both" },
];

export const crops = [
  { id: "maize", label: "Maize", emoji: "🌽" },
  { id: "beans", label: "Beans", emoji: "🫘" },
  { id: "wheat", label: "Wheat", emoji: "🌾" },
  { id: "rice", label: "Rice", emoji: "🍚" },
  { id: "vegetables", label: "Vegetables", emoji: "🥬" },
  { id: "potatoes", label: "Potatoes", emoji: "🥔" },
  { id: "tea", label: "Tea", emoji: "🍵" },
  { id: "coffee", label: "Coffee", emoji: "☕" },
];

export const fruits = [
  { id: "mango", label: "Mango", emoji: "🥭" },
  { id: "avocado", label: "Avocado", emoji: "🥑" },
  { id: "banana", label: "Banana", emoji: "🍌" },
  { id: "citrus", label: "Citrus", emoji: "🍊" },
  { id: "passion", label: "Passion Fruit", emoji: "🫐" },
  { id: "pineapple", label: "Pineapple", emoji: "🍍" },
];

export const fishSpecies = [
  { id: "tilapia", label: "Tilapia", emoji: "🐟" },
  { id: "catfish", label: "Catfish", emoji: "🐡" },
  { id: "trout", label: "Trout", emoji: "🐠" },
  { id: "carp", label: "Carp", emoji: "🐟" },
];

export type OnboardingData = {
  name: string;
  location: string;
  selectedTypes: string[];
  selectedScale: string;
  // Follow-up data
  livestockAnimals: string[];
  livestockHerdSize: string;
  livestockPurpose: string;
  poultryBirds: string[];
  poultryFlockSize: string;
  poultryFocus: string;
  crops: string[];
  fruits: string[];
  fishSpecies: string[];
  fishPondCount: string;
  hiveCount: string;
};

export const defaultOnboardingData: OnboardingData = {
  name: "",
  location: "Nairobi, Kenya",
  selectedTypes: [],
  selectedScale: "",
  livestockAnimals: [],
  livestockHerdSize: "",
  livestockPurpose: "",
  poultryBirds: [],
  poultryFlockSize: "",
  poultryFocus: "",
  crops: [],
  fruits: [],
  fishSpecies: [],
  fishPondCount: "",
  hiveCount: "",
};
