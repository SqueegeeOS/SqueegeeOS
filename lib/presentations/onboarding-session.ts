const STEP_KEY_PREFIX = "pres-onboarding-step:";

export type PersistedOnboardingStep =
  | "sign"
  | "welcome"
  | "payment"
  | "complete";

function storageKey(presentationId: string): string {
  return `${STEP_KEY_PREFIX}${presentationId}`;
}

export function saveOnboardingStep(
  presentationId: string,
  step: PersistedOnboardingStep,
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(presentationId), step);
  } catch {
    // Private browsing / quota — non-fatal.
  }
}

export function readOnboardingStep(
  presentationId: string,
): PersistedOnboardingStep | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(presentationId));
    if (
      raw === "sign" ||
      raw === "welcome" ||
      raw === "payment" ||
      raw === "complete"
    ) {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearOnboardingStep(presentationId: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(storageKey(presentationId));
  } catch {
    // ignore
  }
}

export function shouldResumeOnboarding(
  presentationId: string,
  onboardingStatus: string | null | undefined,
): boolean {
  if (onboardingStatus === "complete") return false;
  const saved = readOnboardingStep(presentationId);
  return saved !== null && saved !== "sign";
}
