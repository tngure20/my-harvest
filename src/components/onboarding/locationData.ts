// All 47 Kenyan counties
export const kenyanCounties = [
  "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet",
  "Embu", "Garissa", "Homa Bay", "Isiolo", "Kajiado",
  "Kakamega", "Kericho", "Kiambu", "Kilifi", "Kirinyaga",
  "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia",
  "Lamu", "Machakos", "Makueni", "Mandera", "Marsabit",
  "Meru", "Migori", "Mombasa", "Murang'a", "Nairobi",
  "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua",
  "Nyeri", "Samburu", "Siaya", "Taita-Taveta", "Tana River",
  "Tharaka-Nithi", "Trans-Nzoia", "Turkana", "Uasin Gishu",
  "Vihiga", "Wajir", "West Pokot",
];

// Supported countries with region labels
export const countries = [
  { id: "KE", name: "Kenya 🇰🇪", regionLabel: "County" },
  { id: "UG", name: "Uganda 🇺🇬", regionLabel: "District" },
  { id: "TZ", name: "Tanzania 🇹🇿", regionLabel: "Region" },
  { id: "ET", name: "Ethiopia 🇪🇹", regionLabel: "Region" },
  { id: "RW", name: "Rwanda 🇷🇼", regionLabel: "Province" },
  { id: "NG", name: "Nigeria 🇳🇬", regionLabel: "State" },
  { id: "GH", name: "Ghana 🇬🇭", regionLabel: "Region" },
  { id: "ZA", name: "South Africa 🇿🇦", regionLabel: "Province" },
  { id: "IN", name: "India 🇮🇳", regionLabel: "State" },
  { id: "US", name: "United States 🇺🇸", regionLabel: "State" },
  { id: "GB", name: "United Kingdom 🇬🇧", regionLabel: "Region" },
  { id: "OTHER", name: "Other", regionLabel: "Region" },
];

export interface LocationData {
  country: string;
  countryCode: string;
  region: string;
}
