import type { PresentationQuoteSnapshot } from "./quote-snapshot";
import { isCarePlanQuoteSnapshot } from "./quote-snapshot";
import type {
  PresentationData,
  PresentationTier,
  SlideOverride,
  SlideType,
  VisitRateOverrides,
} from "./types";

export const PRESENTATION_DRAFT_SCHEMA_VERSION = 1;

export interface PresentationDraftPayload {
  schemaVersion: typeof PRESENTATION_DRAFT_SCHEMA_VERSION;
  clientName: string;
  clientAddress: string;
  clientEmail: string;
  homeSqft: number;
  twoStory: boolean;
  includeScreens: boolean;
  includeInterior: boolean;
  tier: PresentationTier;
  monthlyRate: number;
  overrideTier: PresentationTier | null;
  visitRateOverrides: VisitRateOverrides;
  retailValue: number;
  enrollmentSavings: number;
  customNotes: string;
  quoteSnapshot: PresentationQuoteSnapshot | null;
  slideOverrides: Partial<Record<SlideType, SlideOverride>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function tierValue(value: unknown, fallback: PresentationTier): PresentationTier {
  return value === "biannual" || value === "triannual" || value === "quarterly"
    ? value
    : fallback;
}

function nullableTierValue(
  value: unknown,
  fallback: PresentationTier | null,
): PresentationTier | null {
  if (value === null) return null;
  return value === "biannual" || value === "triannual" || value === "quarterly"
    ? value
    : fallback;
}

function visitRateOverridesValue(
  value: unknown,
  fallback: VisitRateOverrides,
): VisitRateOverrides {
  if (!isRecord(value)) return fallback;

  const overrides: VisitRateOverrides = {};
  for (const tier of ["biannual", "triannual", "quarterly"] as const) {
    const rate = value[tier];
    if (typeof rate === "number" && Number.isFinite(rate) && rate > 0) {
      overrides[tier] = rate;
    }
  }
  return overrides;
}

function slideOverridesValue(
  value: unknown,
  fallback: PresentationData["slideOverrides"],
): PresentationData["slideOverrides"] {
  return isRecord(value)
    ? (value as PresentationData["slideOverrides"])
    : fallback;
}

function quoteSnapshotValue(
  value: unknown,
  fallback: PresentationQuoteSnapshot | null | undefined,
): PresentationQuoteSnapshot | null {
  if (value === null) return null;
  if (!isRecord(value)) return fallback ?? null;
  const candidate = value as unknown as PresentationQuoteSnapshot;
  return isCarePlanQuoteSnapshot(candidate) ? candidate : (fallback ?? null);
}

/**
 * One durable copy of every field a person can enter in the presentation
 * editor. The relational columns remain useful for querying and reporting;
 * this payload guarantees that future editor changes cannot silently fall out
 * of the save/reopen round trip.
 */
export function createPresentationDraftPayload(
  data: PresentationData,
): PresentationDraftPayload {
  return {
    schemaVersion: PRESENTATION_DRAFT_SCHEMA_VERSION,
    clientName: data.clientName,
    clientAddress: data.clientAddress,
    clientEmail: data.clientEmail,
    homeSqft: data.homeSqft,
    twoStory: data.twoStory,
    includeScreens: data.includeScreens,
    includeInterior: data.includeInterior,
    tier: data.tier,
    monthlyRate: data.monthlyRate,
    overrideTier: data.overrideTier ?? null,
    visitRateOverrides: { ...(data.visitRateOverrides ?? {}) },
    retailValue: data.retailValue,
    enrollmentSavings: data.enrollmentSavings,
    customNotes: data.customNotes,
    quoteSnapshot: data.quoteSnapshot ?? null,
    slideOverrides: { ...(data.slideOverrides ?? {}) },
  };
}

/** Apply a saved editor snapshot without allowing it to rewrite identity or lifecycle fields. */
export function restorePresentationDraftPayload(
  base: PresentationData,
  payload: unknown,
): PresentationData {
  if (!isRecord(payload)) return base;

  return {
    ...base,
    clientName: stringValue(payload.clientName, base.clientName),
    clientAddress: stringValue(payload.clientAddress, base.clientAddress),
    clientEmail: stringValue(payload.clientEmail, base.clientEmail),
    homeSqft: numberValue(payload.homeSqft, base.homeSqft),
    twoStory: booleanValue(payload.twoStory, base.twoStory),
    includeScreens: booleanValue(payload.includeScreens, base.includeScreens),
    includeInterior: booleanValue(payload.includeInterior, base.includeInterior),
    tier: tierValue(payload.tier, base.tier),
    monthlyRate: numberValue(payload.monthlyRate, base.monthlyRate),
    overrideTier: nullableTierValue(
      payload.overrideTier,
      base.overrideTier ?? null,
    ),
    visitRateOverrides: visitRateOverridesValue(
      payload.visitRateOverrides,
      base.visitRateOverrides ?? {},
    ),
    retailValue: numberValue(payload.retailValue, base.retailValue),
    enrollmentSavings: numberValue(
      payload.enrollmentSavings,
      base.enrollmentSavings,
    ),
    customNotes: stringValue(payload.customNotes, base.customNotes),
    quoteSnapshot: quoteSnapshotValue(payload.quoteSnapshot, base.quoteSnapshot),
    slideOverrides: slideOverridesValue(
      payload.slideOverrides,
      base.slideOverrides,
    ),
  };
}
