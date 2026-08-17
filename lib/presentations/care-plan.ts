import type { SqueegeeKingTierId } from "@/lib/membership/tier-config";

export const PRESENTATION_CARE_PLAN_VERSION = 3 as const;

export type PresentationPlanMode = "simple" | "custom";
export type PresentationLayout = "signature" | "concise" | "story";
export type CarePlanServiceState = "included" | "optional" | "not_included";
export type CarePlanServiceId =
  | "exteriorWindows"
  | "interiorWindows"
  | "screens"
  | "cobwebRemoval"
  | "solarPanels"
  | "pressureWashing";
export type CarePlanPricedServiceId = Exclude<
  CarePlanServiceId,
  "exteriorWindows"
>;
export type CarePlanServicePolicy =
  | "always_included"
  | "selected_visits"
  | "optional_add_on"
  | "not_offered";

export interface CarePlanServicePrices {
  interiorWindows: number;
  screens: number;
  cobwebRemoval: number;
  solarPanels: number;
  pressureWashing: number;
}

/**
 * Presentation defaults only. Public estimates remain exterior-only until the
 * owner deliberately includes one of these services in a customer plan.
 */
export const DEFAULT_CARE_PLAN_SERVICE_PRICES: CarePlanServicePrices = {
  interiorWindows: 100,
  screens: 50,
  cobwebRemoval: 50,
  // Property-specific services stay at $0 until the owner quotes them or
  // supplies an exact visit total. HomeAtlas must never invent the price.
  solarPanels: 0,
  pressureWashing: 0,
};

export interface CarePlanVisit {
  id: string;
  label: string;
  timing: string;
  exteriorWindows: CarePlanServiceState;
  interiorWindows: CarePlanServiceState;
  screens: CarePlanServiceState;
  cobwebRemoval: CarePlanServiceState;
  solarPanels: CarePlanServiceState;
  pressureWashing: CarePlanServiceState;
  notes: string;
  /** Final quoted total for this visit. Null uses the pricing engine. */
  priceOverride: number | null;
}

export interface PresentationCarePlan {
  version: typeof PRESENTATION_CARE_PLAN_VERSION;
  tier: SqueegeeKingTierId;
  summary: string;
  customerChoiceNote: string;
  servicePrices: CarePlanServicePrices;
  visits: CarePlanVisit[];
}

export type CarePlanPresetId =
  | "exterior_only"
  | "screens_every_visit"
  | "annual_interior"
  | "flexible_add_ons"
  | "full_service"
  | "solar_window_rotation";

export const PRESENTATION_LAYOUT_OPTIONS: Array<{
  id: PresentationLayout;
  label: string;
  description: string;
  slideCount: string;
}> = [
  {
    id: "signature",
    label: "Signature",
    description: "The complete premium story with plan, value, and process.",
    slideCount: "7–8 slides",
  },
  {
    id: "concise",
    label: "Quick close",
    description: "A focused driveway version for customers ready to decide.",
    slideCount: "4–5 slides",
  },
  {
    id: "story",
    label: "Home story",
    description: "More emotion and education before the investment.",
    slideCount: "7–8 slides",
  },
];

const VISIT_LABELS: Record<SqueegeeKingTierId, string[]> = {
  biannual: ["First service", "Second service"],
  triannual: ["First service", "Second service", "Third service"],
  quarterly: [
    "First service",
    "Second service",
    "Third service",
    "Fourth service",
  ],
};

const VISIT_TIMING: Record<SqueegeeKingTierId, string[]> = {
  biannual: ["Initial care visit", "About 6 months later"],
  triannual: [
    "Initial care visit",
    "About 4 months later",
    "About 4 months later",
  ],
  quarterly: [
    "Initial care visit",
    "About 3 months later",
    "About 3 months later",
    "About 3 months later",
  ],
};

export function visitsForTier(tier: SqueegeeKingTierId): number {
  return tier === "quarterly" ? 4 : tier === "triannual" ? 3 : 2;
}

function createVisitId(index: number): string {
  return `visit_${index + 1}`;
}

export function createDefaultCarePlan(input: {
  tier: SqueegeeKingTierId;
  includeInterior?: boolean;
  includeScreens?: boolean;
  includeCobwebRemoval?: boolean;
  servicePrices?: Partial<CarePlanServicePrices>;
}): PresentationCarePlan {
  const count = visitsForTier(input.tier);
  const summary = input.includeInterior
    ? input.includeScreens
      ? "Interior windows, exterior windows, and screens on every scheduled visit."
      : "Interior and exterior window care on every scheduled visit."
    : input.includeScreens
      ? "Exterior windows and screens on every scheduled visit."
      : "Exterior window care on every scheduled visit.";
  return {
    version: PRESENTATION_CARE_PLAN_VERSION,
    tier: input.tier,
    summary,
    customerChoiceNote: "Optional services are confirmed before each visit.",
    servicePrices: {
      ...DEFAULT_CARE_PLAN_SERVICE_PRICES,
      ...input.servicePrices,
    },
    visits: Array.from({ length: count }, (_, index) => ({
      id: createVisitId(index),
      label: VISIT_LABELS[input.tier][index] ?? `Visit ${index + 1}`,
      timing: VISIT_TIMING[input.tier][index] ?? "Scheduled with your care team",
      exteriorWindows: "included",
      interiorWindows: input.includeInterior ? "included" : "not_included",
      screens: input.includeScreens ? "included" : "not_included",
      cobwebRemoval: input.includeCobwebRemoval
        ? "included"
        : "not_included",
      solarPanels: "not_included",
      pressureWashing: "not_included",
      notes: "",
      priceOverride: null,
    })),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function serviceState(
  value: unknown,
  fallback: CarePlanServiceState,
): CarePlanServiceState {
  return value === "included" ||
    value === "optional" ||
    value === "not_included"
    ? value
    : fallback;
}

function finitePrice(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value * 100) / 100
    : null;
}

function servicePrice(value: unknown, fallback: number): number {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100_000
    ? Math.round(value * 100) / 100
    : fallback;
}

function tierValue(
  value: unknown,
  fallback: SqueegeeKingTierId,
): SqueegeeKingTierId {
  return value === "biannual" || value === "triannual" || value === "quarterly"
    ? value
    : fallback;
}

export function normalizePresentationLayout(
  value: unknown,
  fallback: PresentationLayout = "signature",
): PresentationLayout {
  return value === "signature" || value === "concise" || value === "story"
    ? value
    : fallback;
}

export function normalizePresentationPlanMode(
  value: unknown,
  fallback: PresentationPlanMode = "simple",
): PresentationPlanMode {
  return value === "simple" || value === "custom" ? value : fallback;
}

export function normalizeCarePlan(
  value: unknown,
  fallback: PresentationCarePlan,
): PresentationCarePlan {
  if (!isRecord(value)) return fallback;

  const tier = tierValue(value.tier, fallback.tier);
  const defaults = createDefaultCarePlan({ tier });
  const sourceVisits = Array.isArray(value.visits) ? value.visits : [];
  const rawServicePrices = isRecord(value.servicePrices)
    ? value.servicePrices
    : {};
  const expectedCount = visitsForTier(tier);

  const visits = Array.from({ length: expectedCount }, (_, index) => {
    const raw = isRecord(sourceVisits[index]) ? sourceVisits[index] : {};
    const base = defaults.visits[index]!;
    return {
      id:
        typeof raw.id === "string" && raw.id.trim()
          ? raw.id.trim().slice(0, 64)
          : base.id,
      label:
        typeof raw.label === "string" && raw.label.trim()
          ? raw.label.trim().slice(0, 80)
          : base.label,
      timing:
        typeof raw.timing === "string" && raw.timing.trim()
          ? raw.timing.trim().slice(0, 100)
          : base.timing,
      // Version 1/2 plans had no exterior field because exterior was implicit.
      // Falling back to the default preserves that signed customer intent.
      exteriorWindows: serviceState(
        raw.exteriorWindows,
        base.exteriorWindows,
      ),
      interiorWindows: serviceState(
        raw.interiorWindows,
        base.interiorWindows,
      ),
      screens: serviceState(raw.screens, base.screens),
      cobwebRemoval: serviceState(
        raw.cobwebRemoval,
        base.cobwebRemoval,
      ),
      solarPanels: serviceState(raw.solarPanels, base.solarPanels),
      pressureWashing: serviceState(
        raw.pressureWashing,
        base.pressureWashing,
      ),
      notes:
        typeof raw.notes === "string" ? raw.notes.trim().slice(0, 240) : "",
      priceOverride: finitePrice(raw.priceOverride),
    } satisfies CarePlanVisit;
  });

  return {
    version: PRESENTATION_CARE_PLAN_VERSION,
    tier,
    summary:
      typeof value.summary === "string" && value.summary.trim()
        ? value.summary.trim().slice(0, 320)
        : fallback.summary,
    customerChoiceNote:
      typeof value.customerChoiceNote === "string"
        ? value.customerChoiceNote.trim().slice(0, 320)
        : fallback.customerChoiceNote,
    servicePrices: {
      interiorWindows: servicePrice(
        rawServicePrices.interiorWindows,
        fallback.servicePrices.interiorWindows,
      ),
      screens: servicePrice(
        rawServicePrices.screens,
        fallback.servicePrices.screens,
      ),
      cobwebRemoval: servicePrice(
        rawServicePrices.cobwebRemoval,
        fallback.servicePrices.cobwebRemoval,
      ),
      solarPanels: servicePrice(
        rawServicePrices.solarPanels,
        fallback.servicePrices.solarPanels,
      ),
      pressureWashing: servicePrice(
        rawServicePrices.pressureWashing,
        fallback.servicePrices.pressureWashing,
      ),
    },
    visits,
  };
}

export function resizeCarePlan(
  plan: PresentationCarePlan,
  tier: SqueegeeKingTierId,
): PresentationCarePlan {
  const fallback = createDefaultCarePlan({ tier });
  return normalizeCarePlan(
    {
      ...plan,
      tier,
      visits: Array.from({ length: visitsForTier(tier) }, (_, index) =>
        plan.visits[index]
          ? {
              ...plan.visits[index],
              id: createVisitId(index),
              label:
                plan.visits[index]?.label || fallback.visits[index]?.label,
              timing: fallback.visits[index]?.timing,
            }
          : fallback.visits[index],
      ),
    },
    fallback,
  );
}

export function applyCarePlanPreset(
  plan: PresentationCarePlan,
  preset: CarePlanPresetId,
): PresentationCarePlan {
  const visits = plan.visits.map((visit, index) => {
    if (preset === "solar_window_rotation") {
      return {
        ...visit,
        exteriorWindows:
          index === 1 || index === plan.visits.length - 1
            ? ("included" as const)
            : ("not_included" as const),
        solarPanels:
          index < Math.min(3, plan.visits.length)
            ? ("included" as const)
            : ("not_included" as const),
        pressureWashing: "not_included" as const,
        screens: "not_included" as const,
        interiorWindows: "not_included" as const,
        cobwebRemoval: "not_included" as const,
      };
    }
    if (preset === "screens_every_visit") {
      return {
        ...visit,
        exteriorWindows: "included" as const,
        screens: "included" as const,
        interiorWindows: "not_included" as const,
        cobwebRemoval: "not_included" as const,
        solarPanels: "not_included" as const,
        pressureWashing: "not_included" as const,
      };
    }
    if (preset === "annual_interior") {
      return {
        ...visit,
        exteriorWindows: "included" as const,
        screens: "not_included" as const,
        interiorWindows: index === 0 ? ("included" as const) : ("not_included" as const),
        cobwebRemoval: "not_included" as const,
        solarPanels: "not_included" as const,
        pressureWashing: "not_included" as const,
      };
    }
    if (preset === "flexible_add_ons") {
      return {
        ...visit,
        exteriorWindows: "included" as const,
        screens: "optional" as const,
        interiorWindows: "optional" as const,
        cobwebRemoval: "optional" as const,
        solarPanels: "optional" as const,
        pressureWashing: "optional" as const,
      };
    }
    if (preset === "full_service") {
      return {
        ...visit,
        exteriorWindows: "included" as const,
        screens: "included" as const,
        interiorWindows: "included" as const,
        cobwebRemoval: "included" as const,
        solarPanels: "not_included" as const,
        pressureWashing: "not_included" as const,
      };
    }
    return {
      ...visit,
      exteriorWindows: "included" as const,
      screens: "not_included" as const,
      interiorWindows: "not_included" as const,
      cobwebRemoval: "not_included" as const,
      solarPanels: "not_included" as const,
      pressureWashing: "not_included" as const,
    };
  });

  const summaryByPreset: Record<CarePlanPresetId, string> = {
    exterior_only: "Exterior window care on every scheduled visit.",
    screens_every_visit:
      "Exterior windows and screens are cared for on every scheduled visit.",
    annual_interior:
      "Exterior windows every visit, with one complete interior cleaning each year.",
    flexible_add_ons:
      "Exterior windows every visit, with interior, screens, and cobweb removal available by request.",
    full_service:
      "Interior windows, exterior windows, screens, and cobweb removal on every scheduled visit.",
    solar_window_rotation:
      "A custom solar-panel and exterior-window rotation, with each visit scoped separately.",
  };

  return { ...plan, summary: summaryByPreset[preset], visits };
}

export function deriveCarePlanServicePolicy(
  plan: PresentationCarePlan,
  serviceId: CarePlanServiceId,
): CarePlanServicePolicy {
  const states = plan.visits.map((visit) => visit[serviceId]);
  if (states.every((state) => state === "included")) {
    return "always_included";
  }
  if (states.every((state) => state === "optional")) {
    return "optional_add_on";
  }
  if (states.every((state) => state === "not_included")) {
    return "not_offered";
  }
  return "selected_visits";
}

export function applyCarePlanServicePolicy(
  plan: PresentationCarePlan,
  serviceId: CarePlanServiceId,
  policy: CarePlanServicePolicy,
): PresentationCarePlan {
  const visits = plan.visits.map((visit, index) => {
    let state: CarePlanServiceState;
    if (policy === "always_included") state = "included";
    else if (policy === "optional_add_on") state = "optional";
    else if (policy === "not_offered") state = "not_included";
    else {
      const hasSelectedVisit = plan.visits.some(
        (candidate) => candidate[serviceId] === "included",
      );
      state = hasSelectedVisit
        ? visit[serviceId] === "included"
          ? "included"
          : "not_included"
        : index === 0
          ? "included"
          : "not_included";
    }
    return { ...visit, [serviceId]: state };
  });
  return { ...plan, visits };
}

export interface CarePlanPricingVisit {
  id: string;
  label: string;
  total: number;
  usedOverride: boolean;
}

export interface CarePlanPricing {
  baseVisitPrice: number;
  annualTotal: number;
  averageVisitPrice: number;
  visits: CarePlanPricingVisit[];
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateCarePlanPricing(input: {
  plan: PresentationCarePlan;
  baseVisitPrice: number;
  interiorAddOn?: number;
  screensAddOn?: number;
  cobwebAddOn?: number;
  solarPanelsAddOn?: number;
  pressureWashingAddOn?: number;
}): CarePlanPricing {
  const interiorAddOn =
    input.interiorAddOn ?? input.plan.servicePrices.interiorWindows;
  const screensAddOn = input.screensAddOn ?? input.plan.servicePrices.screens;
  const cobwebAddOn =
    input.cobwebAddOn ?? input.plan.servicePrices.cobwebRemoval;
  const solarPanelsAddOn =
    input.solarPanelsAddOn ?? input.plan.servicePrices.solarPanels;
  const pressureWashingAddOn =
    input.pressureWashingAddOn ?? input.plan.servicePrices.pressureWashing;
  const baseVisitPrice = roundMoney(Math.max(0, input.baseVisitPrice));
  const visits = input.plan.visits.map((visit) => {
    const computed =
      (visit.exteriorWindows === "included" ? baseVisitPrice : 0) +
      (visit.interiorWindows === "included" ? interiorAddOn : 0) +
      (visit.screens === "included" ? screensAddOn : 0) +
      (visit.cobwebRemoval === "included" ? cobwebAddOn : 0) +
      (visit.solarPanels === "included" ? solarPanelsAddOn : 0) +
      (visit.pressureWashing === "included" ? pressureWashingAddOn : 0);
    const usedOverride = !!visit.priceOverride && visit.priceOverride > 0;
    return {
      id: visit.id,
      label: visit.label,
      total: roundMoney(usedOverride ? visit.priceOverride! : computed),
      usedOverride,
    };
  });
  const annualTotal = roundMoney(
    visits.reduce((total, visit) => total + visit.total, 0),
  );
  return {
    baseVisitPrice,
    annualTotal,
    averageVisitPrice:
      visits.length > 0 ? roundMoney(annualTotal / visits.length) : 0,
    visits,
  };
}

export function summarizeCarePlan(plan: PresentationCarePlan): string {
  const total = plan.visits.length;
  const exteriorIncluded = plan.visits.filter(
    (visit) => visit.exteriorWindows === "included",
  ).length;
  const exteriorOptional = plan.visits.filter(
    (visit) => visit.exteriorWindows === "optional",
  ).length;
  const interiorIncluded = plan.visits.filter(
    (visit) => visit.interiorWindows === "included",
  ).length;
  const interiorOptional = plan.visits.filter(
    (visit) => visit.interiorWindows === "optional",
  ).length;
  const screensIncluded = plan.visits.filter(
    (visit) => visit.screens === "included",
  ).length;
  const screensOptional = plan.visits.filter(
    (visit) => visit.screens === "optional",
  ).length;
  const cobwebIncluded = plan.visits.filter(
    (visit) => visit.cobwebRemoval === "included",
  ).length;
  const cobwebOptional = plan.visits.filter(
    (visit) => visit.cobwebRemoval === "optional",
  ).length;
  const solarIncluded = plan.visits.filter(
    (visit) => visit.solarPanels === "included",
  ).length;
  const solarOptional = plan.visits.filter(
    (visit) => visit.solarPanels === "optional",
  ).length;
  const pressureIncluded = plan.visits.filter(
    (visit) => visit.pressureWashing === "included",
  ).length;
  const pressureOptional = plan.visits.filter(
    (visit) => visit.pressureWashing === "optional",
  ).length;
  const parts: string[] = [];

  if (exteriorIncluded === total) parts.push(`Exterior ${total}×/yr`);
  else if (exteriorIncluded > 0) parts.push(`exterior ${exteriorIncluded}×`);
  else if (exteriorOptional > 0) parts.push("exterior optional");

  if (interiorIncluded > 0) parts.push(`interior ${interiorIncluded}×`);
  else if (interiorOptional > 0) parts.push("interior optional");

  if (screensIncluded === total) parts.push("screens every visit");
  else if (screensIncluded > 0) parts.push(`screens ${screensIncluded}×`);
  else if (screensOptional > 0) parts.push("screens optional");

  if (cobwebIncluded === total) parts.push("cobwebs every visit");
  else if (cobwebIncluded > 0) parts.push(`cobwebs ${cobwebIncluded}×`);
  else if (cobwebOptional > 0) parts.push("cobwebs optional");

  if (solarIncluded === total) parts.push("solar panels every visit");
  else if (solarIncluded > 0) parts.push(`solar panels ${solarIncluded}×`);
  else if (solarOptional > 0) parts.push("solar panels optional");

  if (pressureIncluded === total) parts.push("pressure washing every visit");
  else if (pressureIncluded > 0) {
    parts.push(`pressure washing ${pressureIncluded}×`);
  } else if (pressureOptional > 0) parts.push("pressure washing optional");

  return parts.length > 0 ? parts.join(" · ") : "Custom services by visit";
}

export function serviceStateLabel(state: CarePlanServiceState): string {
  return state === "included"
    ? "Included"
    : state === "optional"
      ? "Optional"
      : "Not included";
}
