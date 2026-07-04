import {
  EMPTY_LEGACY_BASELINE,
  legacyBaselineHasHistory,
  normalizeLegacyBaseline,
  type LegacyBaseline,
} from "@/lib/admin/legacy-baseline";

/** Legacy browser key — founder data must not be written here anymore. */
export const LEGACY_FOUNDER_DRAFT_KEY = "squeegeeking:legacy-baseline";
const LEGACY_ONBOARDING_FLAG_KEY = "squeegeeking:founder-onboarding-complete";

/** Set after a successful one-time cloud import — prevents re-prompting. */
export const HQ_DRAFT_IMPORTED_KEY = "squeegeeking:hq-draft-imported-at";

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

export function markLocalDraftImported(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(HQ_DRAFT_IMPORTED_KEY, new Date().toISOString());
  clearLocalHeadquartersDraft();
}

export function wasLocalDraftImported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem(HQ_DRAFT_IMPORTED_KEY));
}

export function hasUnsyncedLocalDraft(): boolean {
  return readLocalHeadquartersDraft() !== null;
}
