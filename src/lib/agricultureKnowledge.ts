/**
 * Agricultural Knowledge Service
 *
 * Provides structured agricultural guidance templates with verified source references.
 * Designed to be replaced with AI model + verified database queries later.
 *
 * Sources are structured so the UI can display provenance.
 * When connecting to a real backend, replace getGuidance() with an API call.
 */

export interface KnowledgeSource {
  name: string;
  type: "government" | "research" | "fao" | "extension" | "university";
  url?: string;
}

export interface GuidanceSection {
  heading: string;
  points: string[];
}

export interface GuidanceResponse {
  title: string;
  summary: string;
  sections: GuidanceSection[];
  sources: KnowledgeSource[];
  disclaimer: string;
}

// ─── Source References ───────────────────────────────────────────────────────

const SOURCES: Record<string, KnowledgeSource> = {
  moaKenya: { name: "Ministry of Agriculture, Kenya", type: "government", url: "https://kilimo.go.ke" },
  fao: { name: "Food and Agriculture Organization (FAO)", type: "fao", url: "https://www.fao.org" },
  kalro: { name: "Kenya Agricultural & Livestock Research Organization (KALRO)", type: "research", url: "https://www.kalro.org" },
  cimmyt: { name: "International Maize and Wheat Improvement Center (CIMMYT)", type: "research", url: "https://www.cimmyt.org" },
  icipe: { name: "International Centre of Insect Physiology and Ecology (ICIPE)", type: "research", url: "https://www.icipe.org" },
  uonAgri: { name: "University of Nairobi, Faculty of Agriculture", type: "university" },
  ilri: { name: "International Livestock Research Institute (ILRI)", type: "research", url: "https://www.ilri.org" },
  worldfish: { name: "WorldFish Center", type: "research", url: "https://worldfishcenter.org" },
  extensionKenya: { name: "Kenya Agricultural Extension Service", type: "extension" },
};

const DISCLAIMER = "This guidance is for informational purposes. Always consult local agricultural extension officers or qualified professionals for site-specific recommendations.";

// ─── Knowledge Templates ─────────────────────────────────────────────────────

interface KnowledgeEntry {
  keywords: string[];
  response: GuidanceResponse;
}

const knowledgeBase: KnowledgeEntry[] = [
  // CROP - Maize
  {
    keywords: ["maize", "corn", "planting maize", "grow maize"],
    response: {
      title: "Maize Cultivation Guide",
      summary: "Maize is Kenya's staple food crop, grown across diverse agro-ecological zones. Success depends on variety selection, proper spacing, timely planting, and integrated soil fertility management.",
      sections: [
        {
          heading: "Recommended Actions",
          points: [
            "Select certified seed varieties suited to your altitude and rainfall (e.g., H614D for highland, DH04 for mid-altitude, Katumani for dryland).",
            "Plant at the onset of reliable rains. In Kenya's highlands, long rains start March–April; short rains October–November.",
            "Apply DAP fertilizer at planting (50 kg/acre) placed 5–10 cm beside and below the seed.",
            "Maintain spacing of 75 cm between rows and 25–30 cm between plants for optimal yield.",
            "Top-dress with CAN fertilizer (50 kg/acre) when plants reach knee height (4–6 weeks).",
          ],
        },
        {
          heading: "Potential Risks",
          points: [
            "Fall armyworm (Spodoptera frugiperda) — scout fields weekly from emergence. Look for window-pane feeding on young leaves.",
            "Maize lethal necrosis disease (MLND) — use certified disease-free seed and control aphid/thrips vectors.",
            "Striga weed — rotate with legumes and use Imazapyr-resistant (IR) maize varieties in affected areas.",
            "Post-harvest losses can reach 20–30% if grain is not dried to 13% moisture before storage.",
          ],
        },
        {
          heading: "Best Practices",
          points: [
            "Rotate maize with legumes (beans, soybeans) to fix nitrogen and break pest cycles.",
            "Intercrop with beans or cowpeas to improve soil fertility and diversify income.",
            "Use hermetic storage bags (e.g., PICS bags) to reduce post-harvest losses without chemicals.",
            "Keep records of input costs, yields, and weather patterns to improve planning each season.",
          ],
        },
      ],
      sources: [SOURCES.kalro, SOURCES.cimmyt, SOURCES.moaKenya],
      disclaimer: DISCLAIMER,
    },
  },
  // CROP - Tomato
  {
    keywords: ["tomato", "tomatoes", "grow tomato"],
    response: {
      title: "Tomato Production Guide",
      summary: "Tomatoes are a high-value horticultural crop in Kenya. Proper nursery management, staking, disease prevention, and irrigation are key to profitable production.",
      sections: [
        {
          heading: "Recommended Actions",
          points: [
            "Start seedlings in a raised nursery bed or seed trays using sterile media.",
            "Transplant seedlings at 4–6 weeks when they have 4–5 true leaves.",
            "Space plants 60 cm × 45 cm in well-drained, fertile soil with pH 6.0–6.8.",
            "Apply well-decomposed manure (5 tonnes/acre) and NPK 17:17:17 at planting.",
            "Stake or trellis indeterminate varieties to improve air circulation and fruit quality.",
          ],
        },
        {
          heading: "Potential Risks",
          points: [
            "Tuta absoluta (tomato leaf miner) — use pheromone traps and neem-based pesticides.",
            "Late blight (Phytophthora infestans) — avoid overhead irrigation; apply copper-based fungicides preventively.",
            "Bacterial wilt — practice crop rotation (3+ years) and avoid planting after other solanaceous crops.",
          ],
        },
        {
          heading: "Best Practices",
          points: [
            "Mulch around plants to conserve moisture and suppress weeds.",
            "Harvest when fruits show color break for longer shelf life.",
            "Use drip irrigation to deliver water efficiently and reduce foliar diseases.",
          ],
        },
      ],
      sources: [SOURCES.kalro, SOURCES.moaKenya, SOURCES.extensionKenya],
      disclaimer: DISCLAIMER,
    },
  },
  // LIVESTOCK - Dairy
  {
    keywords: ["dairy", "cow", "cattle", "milk", "livestock feeding"],
    response: {
      title: "Dairy Cattle Management Guide",
      summary: "Dairy farming is a major livelihood in Kenya's highlands. Proper nutrition, health management, and breeding are essential for profitable milk production.",
      sections: [
        {
          heading: "Recommended Actions",
          points: [
            "Provide 40–70 kg of fresh Napier grass or 10–15 kg of hay per cow daily, supplemented with 1 kg of dairy meal per 2 litres of milk produced.",
            "Ensure clean water availability — a lactating cow needs 60–100 litres of water daily.",
            "Follow the annual vaccination schedule: FMD, ECF, Brucellosis, Anthrax as per local veterinary advice.",
            "Deworm cattle every 3 months using broad-spectrum anthelmintics, rotating active ingredients.",
            "Maintain proper housing with adequate ventilation, drainage, and 6–8 m² per cow.",
          ],
        },
        {
          heading: "Potential Risks",
          points: [
            "East Coast Fever (ECF) — transmitted by brown ear ticks. Dip or spray cattle regularly.",
            "Mastitis — practice clean milking hygiene, use teat dip, and test with California Mastitis Test (CMT).",
            "Milk fever (hypocalcemia) — supplement calcium in the dry period before calving.",
          ],
        },
        {
          heading: "Best Practices",
          points: [
            "Keep individual animal records: milk yield, breeding dates, health treatments, and body condition scores.",
            "Practice Artificial Insemination (AI) with proven sires to improve genetics.",
            "Establish fodder crops (Napier, Brachiaria, Desmodium) to ensure year-round feed availability.",
          ],
        },
      ],
      sources: [SOURCES.ilri, SOURCES.kalro, SOURCES.extensionKenya],
      disclaimer: DISCLAIMER,
    },
  },
  // LIVESTOCK - Poultry
  {
    keywords: ["poultry", "chicken", "layers", "broilers", "eggs"],
    response: {
      title: "Poultry Management Guide",
      summary: "Poultry farming provides protein and income for millions of farmers. Proper housing, nutrition, biosecurity, and vaccination are essential for success.",
      sections: [
        {
          heading: "Recommended Actions",
          points: [
            "Provide 1 sq ft per broiler and 2 sq ft per layer in the poultry house.",
            "Feed layers with 120–130g of layers mash per bird daily; broilers need starter, grower, and finisher rations.",
            "Ensure 16 hours of light daily for optimal egg production in layers.",
            "Vaccinate against Newcastle disease (day 1, week 3, week 8), Gumboro, and fowl pox.",
            "Provide clean water at all times — birds drink twice the amount of feed consumed.",
          ],
        },
        {
          heading: "Potential Risks",
          points: [
            "Newcastle disease — highly fatal; follow strict vaccination schedules.",
            "Coccidiosis — maintain dry litter, use coccidiostats in feed for young birds.",
            "Heat stress — ensure ventilation; provide electrolytes in water during hot weather.",
          ],
        },
        {
          heading: "Best Practices",
          points: [
            "Practice all-in all-out management to reduce disease carryover.",
            "Implement biosecurity: foot baths, restricted farm access, clean equipment.",
            "Keep daily records of feed consumption, egg production, mortality, and costs.",
          ],
        },
      ],
      sources: [SOURCES.kalro, SOURCES.moaKenya, SOURCES.fao],
      disclaimer: DISCLAIMER,
    },
  },
  // AQUACULTURE
  {
    keywords: ["fish", "tilapia", "aquaculture", "fish pond", "fish farming"],
    response: {
      title: "Fish Farming (Aquaculture) Guide",
      summary: "Aquaculture, particularly tilapia farming, is growing rapidly in Kenya. Pond management, water quality, and proper feeding are critical for profitable fish production.",
      sections: [
        {
          heading: "Recommended Actions",
          points: [
            "Stock fingerlings at 3–5 fish per square metre for semi-intensive pond culture.",
            "Feed fish 2–5% of total body weight daily, adjusting as fish grow.",
            "Test water quality weekly: pH 6.5–9.0, dissolved oxygen >5 mg/L, temperature 25–30°C.",
            "Fertilize ponds with organic manure (chicken or cow) to promote natural food (plankton).",
            "Harvest when fish reach 250–500g (typically 6–8 months for tilapia).",
          ],
        },
        {
          heading: "Potential Risks",
          points: [
            "Low dissolved oxygen — avoid overfeeding; aerate ponds during cloudy weather.",
            "Predators (birds, frogs, snakes) — use netting or fencing around ponds.",
            "Disease outbreaks — quarantine new fish stock; maintain good water quality.",
          ],
        },
        {
          heading: "Best Practices",
          points: [
            "Use mono-sex (all-male) tilapia fingerlings for faster growth and uniform harvest size.",
            "Construct ponds with a drainable outlet for easy harvesting and pond management.",
            "Integrate fish farming with crop or livestock farming for nutrient recycling.",
          ],
        },
      ],
      sources: [SOURCES.worldfish, SOURCES.fao, SOURCES.moaKenya],
      disclaimer: DISCLAIMER,
    },
  },
  // BEEKEEPING
  {
    keywords: ["bee", "beekeeping", "honey", "hive", "apiculture"],
    response: {
      title: "Beekeeping (Apiculture) Guide",
      summary: "Beekeeping is a low-input, high-return enterprise that also supports crop pollination. Kenya has diverse bee flora, making it suitable for honey production across many regions.",
      sections: [
        {
          heading: "Recommended Actions",
          points: [
            "Use Kenya Top Bar Hives (KTBH) or Langstroth hives for manageable colony inspection.",
            "Place hives under shade, 1–2 metres above ground, away from human traffic and livestock.",
            "Inspect hives every 2–4 weeks to check queen status, brood health, and food stores.",
            "Harvest honey when at least 75% of cells are capped. Use a bee smoker during harvest.",
            "Extract honey hygienically using food-grade equipment; strain and store in clean containers.",
          ],
        },
        {
          heading: "Potential Risks",
          points: [
            "Varroa mites — inspect for infestation; use approved organic treatments if detected.",
            "Small hive beetle — maintain strong colonies; keep hive area clean.",
            "Pesticide exposure from nearby farms — communicate with neighboring farmers about spray schedules.",
          ],
        },
        {
          heading: "Best Practices",
          points: [
            "Plant bee-friendly flora near apiaries (sunflower, eucalyptus, croton, citrus).",
            "Keep records of colony strength, honey yields, and seasonal nectar flows.",
            "Join local beekeeping cooperatives for collective marketing and knowledge sharing.",
          ],
        },
      ],
      sources: [SOURCES.icipe, SOURCES.fao, SOURCES.extensionKenya],
      disclaimer: DISCLAIMER,
    },
  },
  // SOIL
  {
    keywords: ["soil", "soil health", "soil test", "fertility", "compost"],
    response: {
      title: "Soil Health & Fertility Management",
      summary: "Healthy soil is the foundation of productive farming. Soil testing, organic matter addition, and balanced fertilization maintain long-term productivity.",
      sections: [
        {
          heading: "Recommended Actions",
          points: [
            "Conduct soil tests every 2–3 years through KALRO or certified labs to know nutrient status and pH.",
            "Apply lime to acidic soils (pH <5.5) at rates recommended by soil test results.",
            "Incorporate organic matter: compost, farmyard manure, or green manure crops.",
            "Use integrated soil fertility management (ISFM) combining organic and mineral inputs.",
          ],
        },
        {
          heading: "Potential Risks",
          points: [
            "Over-reliance on chemical fertilizers depletes organic matter and acidifies soil.",
            "Continuous mono-cropping leads to nutrient mining and soil degradation.",
            "Erosion on sloped land — use contour farming, terracing, or grass strips.",
          ],
        },
        {
          heading: "Best Practices",
          points: [
            "Practice crop rotation with nitrogen-fixing legumes.",
            "Mulch to reduce evaporation, regulate soil temperature, and suppress weeds.",
            "Minimize tillage to preserve soil structure and organic matter.",
          ],
        },
      ],
      sources: [SOURCES.kalro, SOURCES.fao, SOURCES.uonAgri],
      disclaimer: DISCLAIMER,
    },
  },
  // PEST
  {
    keywords: ["pest", "insect", "fall armyworm", "aphid", "pesticide", "spray"],
    response: {
      title: "Integrated Pest Management (IPM)",
      summary: "IPM combines cultural, biological, and chemical methods to manage pests sustainably while minimizing environmental impact and costs.",
      sections: [
        {
          heading: "Recommended Actions",
          points: [
            "Scout fields regularly (at least weekly) to detect pest presence early.",
            "Identify pests accurately before selecting control methods — misidentification leads to wasted inputs.",
            "Use cultural controls first: crop rotation, resistant varieties, proper spacing, field sanitation.",
            "Apply biological controls where available: Trichogramma wasps, neem extracts, Bacillus thuringiensis (Bt).",
            "Use chemical pesticides only as a last resort; follow label instructions and observe pre-harvest intervals.",
          ],
        },
        {
          heading: "Potential Risks",
          points: [
            "Pesticide resistance develops when the same chemicals are used repeatedly.",
            "Residue on produce can affect market access, especially for export crops.",
            "Killing beneficial insects (pollinators, predators) worsens pest problems long-term.",
          ],
        },
        {
          heading: "Best Practices",
          points: [
            "Rotate pesticide classes (mode of action) to prevent resistance.",
            "Wear protective equipment when handling pesticides: gloves, mask, overalls.",
            "Keep a spray diary recording dates, products, dosages, and weather conditions.",
          ],
        },
      ],
      sources: [SOURCES.icipe, SOURCES.fao, SOURCES.kalro],
      disclaimer: DISCLAIMER,
    },
  },
  // IRRIGATION
  {
    keywords: ["irrigation", "water", "drip", "sprinkler", "drought"],
    response: {
      title: "Irrigation & Water Management",
      summary: "Efficient water use is critical for crop production, especially in arid and semi-arid regions. Drip irrigation can reduce water use by 40–60% compared to flood methods.",
      sections: [
        {
          heading: "Recommended Actions",
          points: [
            "Assess water source reliability: river, borehole, dam, or rainwater harvesting.",
            "Choose irrigation method based on crop, terrain, and budget — drip for vegetables, sprinkler for field crops.",
            "Schedule irrigation based on soil moisture rather than fixed intervals.",
            "Install water filters to prevent emitter clogging in drip systems.",
          ],
        },
        {
          heading: "Potential Risks",
          points: [
            "Over-irrigation causes waterlogging, root diseases, and nutrient leaching.",
            "Salinization from poor drainage or use of brackish water.",
            "High initial costs of drip systems — explore group purchasing or government subsidies.",
          ],
        },
        {
          heading: "Best Practices",
          points: [
            "Mulch around crops to reduce evaporation by 25–50%.",
            "Harvest rainwater using ponds, tanks, or terrace systems for supplemental irrigation.",
            "Irrigate early morning or late evening to minimize evaporation losses.",
          ],
        },
      ],
      sources: [SOURCES.fao, SOURCES.moaKenya, SOURCES.extensionKenya],
      disclaimer: DISCLAIMER,
    },
  },
];

// ─── Diagnosis Templates ─────────────────────────────────────────────────────

interface DiagnosisEntry {
  keywords: string[];
  response: GuidanceResponse;
}

const diagnosisBase: DiagnosisEntry[] = [
  {
    keywords: ["yellow leaves", "yellowing", "chlorosis"],
    response: {
      title: "Leaf Yellowing (Chlorosis) — Diagnostic Guide",
      summary: "Yellowing leaves can indicate nutrient deficiency, water stress, or disease. Accurate diagnosis requires examining the pattern and location of yellowing.",
      sections: [
        { heading: "Possible Causes", points: [
          "Nitrogen deficiency — older/lower leaves yellow first, plant appears pale green overall.",
          "Iron deficiency — young/new leaves yellow while veins remain green (interveinal chlorosis).",
          "Overwatering or poor drainage — roots suffocate, causing general yellowing and wilting.",
          "Viral infection — irregular yellow mosaic or streaking patterns on leaves.",
        ]},
        { heading: "Diagnostic Steps", points: [
          "Note which leaves are affected: old (lower) vs. new (upper).",
          "Check soil moisture — is the soil waterlogged or very dry?",
          "Look for pest damage (aphids, whiteflies) that may transmit viruses.",
          "Submit a soil sample for nutrient analysis if deficiency is suspected.",
        ]},
        { heading: "Recommended Treatment", points: [
          "For nitrogen deficiency: top-dress with CAN or urea at recommended rates.",
          "For iron deficiency: apply chelated iron foliar spray.",
          "For waterlogging: improve drainage; reduce irrigation frequency.",
          "For viral infection: remove and destroy affected plants; control insect vectors.",
        ]},
      ],
      sources: [SOURCES.kalro, SOURCES.extensionKenya],
      disclaimer: DISCLAIMER,
    },
  },
  {
    keywords: ["wilt", "wilting", "drooping"],
    response: {
      title: "Plant Wilting — Diagnostic Guide",
      summary: "Wilting occurs when plants lose turgor pressure. Causes range from water stress to bacterial or fungal disease. The key is distinguishing reversible wilt from permanent wilt.",
      sections: [
        { heading: "Possible Causes", points: [
          "Water stress — check soil moisture; plants may recover when watered.",
          "Bacterial wilt (Ralstonia) — cut stem and place in water; bacterial streaming indicates infection.",
          "Fusarium or Verticillium wilt — one-sided wilting; vascular browning visible when stem is cut.",
          "Root damage — nematodes, grubs, or physical damage disrupting water uptake.",
        ]},
        { heading: "Diagnostic Steps", points: [
          "Water the plant and observe recovery — reversible wilt = water stress.",
          "Cut the main stem at soil level and check for brown discoloration of vascular tissue.",
          "Place cut stem in clear water and observe for milky bacterial ooze (bacterial wilt test).",
          "Check roots for galls (nematodes) or rot (fungal pathogens).",
        ]},
        { heading: "Recommended Treatment", points: [
          "For water stress: establish consistent irrigation schedule.",
          "For bacterial wilt: remove infected plants; rotate with non-host crops for 3+ seasons.",
          "For fungal wilt: apply registered fungicides; use resistant varieties.",
          "For nematodes: apply nematicides or practice soil solarization.",
        ]},
      ],
      sources: [SOURCES.kalro, SOURCES.fao, SOURCES.uonAgri],
      disclaimer: DISCLAIMER,
    },
  },
  {
    keywords: ["sick cow", "cattle disease", "livestock sick", "cattle not eating", "cow sick"],
    response: {
      title: "Livestock Health — Diagnostic Guide",
      summary: "Sick cattle require prompt attention. Observe symptoms carefully and consult a veterinarian for diagnosis and treatment. Early intervention reduces mortality and economic loss.",
      sections: [
        { heading: "Common Symptoms & Possible Causes", points: [
          "Reduced appetite + fever + swollen lymph nodes → East Coast Fever (ECF), transmitted by ticks.",
          "Bloody diarrhea + fever → possible Coccidiosis (young animals) or Babesiosis (tick-borne).",
          "Nasal discharge + coughing → Pneumonia or Contagious Bovine Pleuropneumonia (CBPP).",
          "Swollen udder + abnormal milk → Mastitis (bacterial infection of the udder).",
          "Staggering + drooling + aggression → possible rabies or plant poisoning. Isolate immediately.",
        ]},
        { heading: "Immediate Actions", points: [
          "Isolate the sick animal from the rest of the herd.",
          "Record all symptoms, duration, and any recent changes in feed or environment.",
          "Take the animal's temperature (normal: 38.5–39.5°C for cattle).",
          "Contact a qualified veterinarian for professional diagnosis and treatment.",
        ]},
        { heading: "Prevention", points: [
          "Follow recommended vaccination schedules for your area.",
          "Maintain regular tick control through dipping, spraying, or pour-on acaricides.",
          "Practice good hygiene in housing and feeding areas.",
          "Quarantine new animals for at least 2 weeks before introducing to the herd.",
        ]},
      ],
      sources: [SOURCES.ilri, SOURCES.kalro, SOURCES.extensionKenya],
      disclaimer: DISCLAIMER,
    },
  },
];

// ─── Planning Templates ──────────────────────────────────────────────────────

const planningBase: KnowledgeEntry[] = [
  {
    keywords: ["planting schedule", "when to plant", "season", "calendar"],
    response: {
      title: "Planting Calendar & Seasonal Planning",
      summary: "Timing planting with reliable rainfall significantly affects crop success. Use historical weather data and seasonal forecasts to plan your farming calendar.",
      sections: [
        { heading: "Kenya Long Rains (March–May)", points: [
          "Plant maize, beans, and sorghum in March at onset of rains in most regions.",
          "Transplant tomato and pepper seedlings after 2–3 good rains establish soil moisture.",
          "Apply basal fertilizer at planting; top-dress 4–6 weeks later.",
        ]},
        { heading: "Kenya Short Rains (October–December)", points: [
          "Plant quick-maturing varieties (90-day maize, bush beans, cowpeas).",
          "Focus on drought-tolerant crops in ASAL areas.",
          "Prepare land and purchase inputs in September before rains begin.",
        ]},
        { heading: "Planning Tips", points: [
          "Monitor Kenya Meteorological Department seasonal forecasts.",
          "Keep a farm diary tracking planting dates, rainfall, and yields each season.",
          "Plan input purchases and financing 1–2 months before planting season.",
          "Consider staggered planting to spread risk and extend harvest period.",
        ]},
      ],
      sources: [SOURCES.moaKenya, SOURCES.kalro, SOURCES.fao],
      disclaimer: DISCLAIMER,
    },
  },
  {
    keywords: ["fertilizer plan", "fertilizer schedule", "nutrient plan"],
    response: {
      title: "Fertilizer Application Planning",
      summary: "A balanced fertilizer plan based on soil test results and crop requirements maximizes yields while minimizing waste and environmental impact.",
      sections: [
        { heading: "Planning Steps", points: [
          "Get a soil test to determine current nutrient levels and pH.",
          "Match fertilizer type and rate to crop requirements and soil deficiencies.",
          "Split applications: basal at planting + top-dress during active growth.",
          "Budget for inputs — calculate cost per acre and expected return on investment.",
        ]},
        { heading: "Common Fertilizer Guide (Kenya)", points: [
          "Maize: DAP 50 kg/acre at planting + CAN 50 kg/acre top-dress.",
          "Beans: DAP 25–30 kg/acre at planting (beans fix their own nitrogen).",
          "Tomatoes: NPK 17:17:17 at transplanting + CAN foliar during fruiting.",
          "Tea: NPK 26:5:5 applied 4 times per year at 50 kg/acre per application.",
        ]},
        { heading: "Cost Optimization", points: [
          "Buy fertilizer in bulk through farmer cooperatives for better prices.",
          "Combine organic manure with mineral fertilizers to reduce costs.",
          "Apply fertilizer close to the plant root zone to minimize waste.",
        ]},
      ],
      sources: [SOURCES.kalro, SOURCES.moaKenya, SOURCES.extensionKenya],
      disclaimer: DISCLAIMER,
    },
  },
];

// ─── Query Engine ────────────────────────────────────────────────────────────

function findBestMatch(query: string, base: KnowledgeEntry[]): GuidanceResponse | null {
  const q = query.toLowerCase();
  let bestMatch: KnowledgeEntry | null = null;
  let bestScore = 0;

  for (const entry of base) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (q.includes(kw)) score += kw.length; // longer keyword matches score higher
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  return bestMatch?.response ?? null;
}

export type AssistantMode = "advice" | "diagnosis" | "planning";

export function getGuidance(query: string, mode: AssistantMode): GuidanceResponse {
  let result: GuidanceResponse | null = null;

  switch (mode) {
    case "diagnosis":
      result = findBestMatch(query, diagnosisBase);
      if (!result) result = findBestMatch(query, knowledgeBase);
      break;
    case "planning":
      result = findBestMatch(query, planningBase);
      if (!result) result = findBestMatch(query, knowledgeBase);
      break;
    default:
      result = findBestMatch(query, knowledgeBase);
      break;
  }

  if (!result) {
    return {
      title: "General Agricultural Guidance",
      summary: `Thank you for your question about "${query}". While I don't have specific guidance on this topic yet, here are general best practices that apply to most farming operations.`,
      sections: [
        {
          heading: "General Recommendations",
          points: [
            "Consult your local agricultural extension officer for region-specific advice.",
            "Conduct soil tests before applying fertilizers to avoid over- or under-application.",
            "Keep detailed farm records to track inputs, yields, and profitability.",
            "Join local farmer groups to share knowledge and access collective resources.",
            "Monitor weather forecasts and adjust farming activities accordingly.",
          ],
        },
        {
          heading: "Where to Get Help",
          points: [
            "County agricultural offices provide free extension services.",
            "KALRO research centers offer crop- and livestock-specific technical support.",
            "Farmer Training Centers (FTCs) conduct regular workshops on modern farming techniques.",
          ],
        },
      ],
      sources: [SOURCES.moaKenya, SOURCES.fao, SOURCES.extensionKenya],
      disclaimer: DISCLAIMER,
    };
  }

  return result;
}

/**
 * Generate contextual advice based on a farmer's farm activity.
 * In production, this would call an AI model with the activity data as context.
 */
export function getActivityAdvice(activityType: string, species: string): GuidanceResponse {
  const query = `${species} ${activityType}`.toLowerCase();
  return getGuidance(query, "advice");
}

// ─── RAG Corpus Export ────────────────────────────────────────────────────────

export interface CorpusEntry {
  id: string;
  /** Embeddable text: title + keywords + summary combined for semantic search */
  text: string;
  guidance: GuidanceResponse;
}

/**
 * Returns all knowledge base entries as embeddable corpus entries for RAG.
 * Combines knowledgeBase, diagnosisBase, and planningBase into one flat list.
 */
export function getKnowledgeCorpus(): CorpusEntry[] {
  const allEntries: { keywords: string[]; response: GuidanceResponse }[] = [
    ...knowledgeBase,
    ...diagnosisBase,
    ...planningBase,
  ];
  return allEntries.map((entry, i) => ({
    id: String(i),
    text: `${entry.response.title}. Keywords: ${entry.keywords.join(", ")}. ${entry.response.summary}`,
    guidance: entry.response,
  }));
}
