import type {
  ExteriorAddOnId,
  ExteriorAddOnSelection,
} from "@/lib/pricing/types";
import type {
  PresentationTier,
  SlideOverride,
  SlideType,
} from "@/lib/presentations/types";

const ADD_ON_IDS = new Set<ExteriorAddOnId>([
  "soft_wash_exterior",
  "moss_removal",
  "pressure_wash_concrete",
  "screen_rescreening",
]);
const SLIDE_IDS = new Set<SlideType>([
  "cover",
  "included",
  "difference",
  "investment",
  "process",
  "custom_quote",
  "close",
]);

export interface PresentationPricingAuthorityInput {
  squareFeet: number;
  frequency: "quarterly" | "bi_annual";
  includeInterior: boolean;
  twoStory: boolean;
  includeScreens: boolean;
  exteriorAddOns: ExteriorAddOnSelection[];
}

export interface CreatePresentationAuthorityInput {
  authoringSource: "manual" | "care_plan_builder" | "lead_request";
  clientName?: string;
  pricing: PresentationPricingAuthorityInput;
}

export interface PatchPresentationAuthorityInput {
  clientName?: string;
  clientAddress?: string;
  clientEmail?: string;
  homeSqft?: number;
  tier?: PresentationTier;
  twoStory?: boolean;
  includeScreens?: boolean;
  customNotes?: string;
  slideOverrides?: Partial<Record<SlideType, SlideOverride>>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  const allowedSet = new Set(allowed);
  return Object.keys(value).every((key) => allowedSet.has(key));
}

function boundedText(
  value: unknown,
  maximumLength: number,
  allowEmpty = true,
): string | null {
  if (typeof value !== "string" || value.length > maximumLength) return null;
  if (!allowEmpty && !value.trim()) return null;
  return value;
}

function parseExteriorAddOns(value: unknown): ExteriorAddOnSelection[] | null {
  if (!Array.isArray(value) || value.length > ADD_ON_IDS.size) return null;
  const seen = new Set<string>();
  const parsed: ExteriorAddOnSelection[] = [];

  for (const item of value) {
    if (
      !isObject(item) ||
      !hasOnlyKeys(item, ["areaSqft", "enabled", "id", "screenCount"]) ||
      typeof item.id !== "string" ||
      !ADD_ON_IDS.has(item.id as ExteriorAddOnId) ||
      seen.has(item.id) ||
      typeof item.enabled !== "boolean"
    ) {
      return null;
    }
    const areaSqft = item.areaSqft;
    const screenCount = item.screenCount;
    if (
      (areaSqft !== undefined &&
        (typeof areaSqft !== "number" ||
          !Number.isSafeInteger(areaSqft) ||
          areaSqft < 0 ||
          areaSqft > 1_000_000)) ||
      (screenCount !== undefined &&
        (typeof screenCount !== "number" ||
          !Number.isSafeInteger(screenCount) ||
          screenCount < 0 ||
          screenCount > 10_000))
    ) {
      return null;
    }
    seen.add(item.id);
    parsed.push({
      id: item.id as ExteriorAddOnId,
      enabled: item.enabled,
      ...(areaSqft !== undefined ? { areaSqft } : {}),
      ...(screenCount !== undefined ? { screenCount } : {}),
    });
  }

  return parsed;
}

function parsePricing(
  value: unknown,
): PresentationPricingAuthorityInput | null {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, [
      "exteriorAddOns",
      "frequency",
      "includeInterior",
      "includeScreens",
      "squareFeet",
      "twoStory",
    ]) ||
    Object.keys(value).length !== 6 ||
    typeof value.squareFeet !== "number" ||
    !Number.isSafeInteger(value.squareFeet) ||
    (value.frequency !== "quarterly" && value.frequency !== "bi_annual") ||
    typeof value.includeInterior !== "boolean" ||
    typeof value.twoStory !== "boolean" ||
    typeof value.includeScreens !== "boolean"
  ) {
    return null;
  }
  const exteriorAddOns = parseExteriorAddOns(value.exteriorAddOns);
  return exteriorAddOns
    ? {
        squareFeet: value.squareFeet,
        frequency: value.frequency,
        includeInterior: value.includeInterior,
        twoStory: value.twoStory,
        includeScreens: value.includeScreens,
        exteriorAddOns,
      }
    : null;
}

function parseSlideOverrides(
  value: unknown,
): Partial<Record<SlideType, SlideOverride>> | null {
  if (!isObject(value) || Object.keys(value).length > SLIDE_IDS.size) return null;
  const result: Partial<Record<SlideType, SlideOverride>> = {};
  for (const [slideId, override] of Object.entries(value)) {
    if (
      !SLIDE_IDS.has(slideId as SlideType) ||
      !isObject(override) ||
      !hasOnlyKeys(override, ["body", "headline", "highlight"])
    ) {
      return null;
    }
    const parsed: SlideOverride = {};
    for (const key of ["body", "headline", "highlight"] as const) {
      if (override[key] === undefined) continue;
      const text = boundedText(override[key], key === "body" ? 2_000 : 300);
      if (text === null) return null;
      parsed[key] = text;
    }
    result[slideId as SlideType] = parsed;
  }
  return result;
}

export function parseCreatePresentationAuthorityInput(
  value: Record<string, unknown>,
): CreatePresentationAuthorityInput | null {
  if (
    !hasOnlyKeys(value, ["authoringSource", "clientName", "pricing"]) ||
    Object.keys(value).length < 2 ||
    (value.authoringSource !== "manual" &&
      value.authoringSource !== "care_plan_builder" &&
      value.authoringSource !== "lead_request")
  ) {
    return null;
  }
  const pricing = parsePricing(value.pricing);
  const clientName =
    value.clientName === undefined
      ? undefined
      : boundedText(value.clientName, 160, false);
  if (!pricing || clientName === null) return null;
  return {
    authoringSource: value.authoringSource,
    ...(clientName !== undefined ? { clientName } : {}),
    pricing,
  };
}

export function parsePatchPresentationAuthorityInput(
  value: Record<string, unknown>,
): PatchPresentationAuthorityInput | null {
  const allowed = [
    "clientAddress",
    "clientEmail",
    "clientName",
    "customNotes",
    "homeSqft",
    "includeScreens",
    "slideOverrides",
    "tier",
    "twoStory",
  ] as const;
  if (!hasOnlyKeys(value, allowed) || Object.keys(value).length === 0) return null;

  const output: PatchPresentationAuthorityInput = {};
  if (value.clientName !== undefined) {
    const parsed = boundedText(value.clientName, 160, false);
    if (parsed === null) return null;
    output.clientName = parsed;
  }
  if (value.clientAddress !== undefined) {
    const parsed = boundedText(value.clientAddress, 300);
    if (parsed === null) return null;
    output.clientAddress = parsed;
  }
  if (value.clientEmail !== undefined) {
    const parsed = boundedText(value.clientEmail, 320);
    if (
      parsed === null ||
      (parsed.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.trim()))
    ) {
      return null;
    }
    output.clientEmail = parsed;
  }
  if (value.customNotes !== undefined) {
    const parsed = boundedText(value.customNotes, 4_000);
    if (parsed === null) return null;
    output.customNotes = parsed;
  }
  if (value.homeSqft !== undefined) {
    if (typeof value.homeSqft !== "number" || !Number.isSafeInteger(value.homeSqft)) {
      return null;
    }
    output.homeSqft = value.homeSqft;
  }
  if (value.tier !== undefined) {
    if (value.tier !== "biannual" && value.tier !== "quarterly") return null;
    output.tier = value.tier;
  }
  if (value.twoStory !== undefined) {
    if (typeof value.twoStory !== "boolean") return null;
    output.twoStory = value.twoStory;
  }
  if (value.includeScreens !== undefined) {
    if (typeof value.includeScreens !== "boolean") return null;
    output.includeScreens = value.includeScreens;
  }
  if (value.slideOverrides !== undefined) {
    const parsed = parseSlideOverrides(value.slideOverrides);
    if (!parsed) return null;
    output.slideOverrides = parsed;
  }
  return output;
}
