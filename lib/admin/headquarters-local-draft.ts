import {
  EMPTY_LEGACY_BASELINE,
  legacyBaselineHasHistory,
  normalizeLegacyBaseline,
  type LegacyBaseline,
} from "@/lib/admin/legacy-baseline";

/** Legacy browser key — founder data must not be written here anymore. */
export const LEGACY_FOUNDER_DRAFT_KEY = "squeegeeking:legacy-baseline";
const LEGACY_ONBOARDING_FLAG_KEY = "squeegeeking:founder-onboarding-complete";

export function readLocalHeadquartersDraft(): LegacyBaseline | null {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(LEGACY_FOUNDER_DRAFT_KEY);
  if (!raw) return null;

  try {
    const parsed = normalizeLegacyBaseline(
      JSON.parse(raw) as Partial<LegacyBaseline>,
    );
    if (!legacyBaselineHasHistory(parsed) && !parsed.onboardingComplete) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearLocalHeadquartersDraft(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LEGACY_FOUNDER_DRAFT_KEY);
  localStorage.removeItem(LEGACY_ONBOARDING_FLAG_KEY);
}

export function hasUnsyncedLocalDraft(): boolean {
  return readLocalHeadquartersDraft() !== null;
}
