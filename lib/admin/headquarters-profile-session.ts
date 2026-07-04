import {
  EMPTY_LEGACY_BASELINE,
  type LegacyBaseline,
} from "@/lib/admin/legacy-baseline";

/** In-memory headquarters profile for the current browser session — hydrated from Supabase. */
let sessionBaseline: LegacyBaseline | null = null;

export function getHeadquartersSessionBaseline(): LegacyBaseline {
  return sessionBaseline ?? EMPTY_LEGACY_BASELINE;
}

export function setHeadquartersSessionBaseline(baseline: LegacyBaseline): void {
  sessionBaseline = baseline;
}

export function clearHeadquartersSessionBaseline(): void {
  sessionBaseline = null;
}
