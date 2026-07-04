export type AssessmentAreaKey =
  | "window_health"
  | "screen_health"
  | "track_sill_health"
  | "frame_health"
  | "hard_water_risk"
  | "debris_buildup"
  | "roof_condition"
  | "gutter_condition"
  | "concrete_condition"
  | "driveway_condition"
  | "solar_panel_condition"
  | "solar_panel_cleanliness"
  | "exterior_paint_condition"
  | "wood_trim_condition"
  | "fence_condition"
  | "deck_condition"
  | "irrigation_visible_condition"
  | "custom";

export type AssessmentCategory =
  | "windows"
  | "roof"
  | "concrete"
  | "solar"
  | "exterior"
  | "landscape"
  | "custom";

export interface AssessmentAreaDefinition {
  key: AssessmentAreaKey;
  label: string;
  category: AssessmentCategory;
  description: string;
  scoreLabels: Record<1 | 2 | 3 | 4 | 5, string>;
  allowNA: boolean;
  carePackageOnly: boolean;
  icon: string;
}

const CONDITION_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Very Good",
  5: "Excellent",
};

const HEALTH_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "Needs Attention",
  2: "Fair",
  3: "Good",
  4: "Very Good",
  5: "Excellent",
};

const RISK_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "High Risk",
  2: "Elevated",
  3: "Moderate",
  4: "Low",
  5: "None Detected",
};

const CLEANLINESS_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "Very Dirty",
  2: "Dirty",
  3: "Moderate",
  4: "Mostly Clean",
  5: "Clean",
};

export const ASSESSMENT_AREA_LIBRARY: AssessmentAreaDefinition[] = [
  {
    key: "window_health",
    label: "Window Health",
    category: "windows",
    description: "Overall condition of glass surfaces",
    scoreLabels: HEALTH_LABELS,
    allowNA: false,
    carePackageOnly: false,
    icon: "🪟",
  },
  {
    key: "screen_health",
    label: "Screen Health",
    category: "windows",
    description: "Tears, bent frames, missing screens",
    scoreLabels: HEALTH_LABELS,
    allowNA: false,
    carePackageOnly: false,
    icon: "🔲",
  },
  {
    key: "track_sill_health",
    label: "Track & Sill Health",
    category: "windows",
    description: "Debris, corrosion, drainage",
    scoreLabels: HEALTH_LABELS,
    allowNA: false,
    carePackageOnly: false,
    icon: "⬛",
  },
  {
    key: "frame_health",
    label: "Frame Health",
    category: "windows",
    description: "Paint, seals, structural condition",
    scoreLabels: HEALTH_LABELS,
    allowNA: false,
    carePackageOnly: false,
    icon: "🔳",
  },
  {
    key: "hard_water_risk",
    label: "Hard Water Risk",
    category: "windows",
    description: "Mineral deposits, staining",
    scoreLabels: RISK_LABELS,
    allowNA: false,
    carePackageOnly: false,
    icon: "💧",
  },
  {
    key: "debris_buildup",
    label: "Debris & Cobweb Buildup",
    category: "windows",
    description: "Exterior buildup around frames",
    scoreLabels: CLEANLINESS_LABELS,
    allowNA: false,
    carePackageOnly: false,
    icon: "🕸️",
  },
  {
    key: "roof_condition",
    label: "Roof Condition",
    category: "roof",
    description: "Visible shingles, flashing, moss, debris",
    scoreLabels: CONDITION_LABELS,
    allowNA: true,
    carePackageOnly: true,
    icon: "🏠",
  },
  {
    key: "gutter_condition",
    label: "Gutter Condition",
    category: "roof",
    description: "Blockages, sag, overflow staining",
    scoreLabels: CONDITION_LABELS,
    allowNA: true,
    carePackageOnly: true,
    icon: "🌊",
  },
  {
    key: "concrete_condition",
    label: "Concrete Condition",
    category: "concrete",
    description: "Cracks, staining, efflorescence",
    scoreLabels: CONDITION_LABELS,
    allowNA: true,
    carePackageOnly: true,
    icon: "🧱",
  },
  {
    key: "driveway_condition",
    label: "Driveway Condition",
    category: "concrete",
    description: "Oil stains, sealing, surface wear",
    scoreLabels: CONDITION_LABELS,
    allowNA: true,
    carePackageOnly: true,
    icon: "🛣️",
  },
  {
    key: "solar_panel_condition",
    label: "Solar Panel Condition",
    category: "solar",
    description: "Physical damage, microcracks, shading",
    scoreLabels: CONDITION_LABELS,
    allowNA: true,
    carePackageOnly: true,
    icon: "☀️",
  },
  {
    key: "solar_panel_cleanliness",
    label: "Solar Panel Cleanliness",
    category: "solar",
    description: "Dust, bird droppings, hard water film",
    scoreLabels: CLEANLINESS_LABELS,
    allowNA: true,
    carePackageOnly: true,
    icon: "⚡",
  },
  {
    key: "exterior_paint_condition",
    label: "Exterior Paint",
    category: "exterior",
    description: "Peeling, fading, mold, chalking",
    scoreLabels: CONDITION_LABELS,
    allowNA: true,
    carePackageOnly: true,
    icon: "🎨",
  },
  {
    key: "wood_trim_condition",
    label: "Wood Trim Condition",
    category: "exterior",
    description: "Rot, paint failure, insect damage",
    scoreLabels: CONDITION_LABELS,
    allowNA: true,
    carePackageOnly: true,
    icon: "🪵",
  },
  {
    key: "fence_condition",
    label: "Fence Condition",
    category: "exterior",
    description: "Leaning, rot, paint, hardware",
    scoreLabels: CONDITION_LABELS,
    allowNA: true,
    carePackageOnly: true,
    icon: "🚧",
  },
  {
    key: "deck_condition",
    label: "Deck / Patio Condition",
    category: "exterior",
    description: "Sealing, rot, surface wear, railings",
    scoreLabels: CONDITION_LABELS,
    allowNA: true,
    carePackageOnly: true,
    icon: "🪑",
  },
  {
    key: "irrigation_visible_condition",
    label: "Irrigation (Visible)",
    category: "landscape",
    description: "Exposed heads, overspray on windows",
    scoreLabels: CONDITION_LABELS,
    allowNA: true,
    carePackageOnly: true,
    icon: "💦",
  },
];

export const WINDOW_AREA_KEYS: AssessmentAreaKey[] = [
  "window_health",
  "screen_health",
  "track_sill_health",
  "frame_health",
  "hard_water_risk",
  "debris_buildup",
];

export const ADDON_AREAS = ASSESSMENT_AREA_LIBRARY.filter(
  (a) => !WINDOW_AREA_KEYS.includes(a.key),
);

export const CARE_PACKAGE_AREA_KEYS: AssessmentAreaKey[] =
  ASSESSMENT_AREA_LIBRARY.map((a) => a.key);

export function getAreaDefinition(
  key: AssessmentAreaKey,
): AssessmentAreaDefinition | undefined {
  return ASSESSMENT_AREA_LIBRARY.find((a) => a.key === key);
}

export function isAssessmentAreaKey(value: string): value is AssessmentAreaKey {
  return ASSESSMENT_AREA_LIBRARY.some((a) => a.key === value);
}
