/**
 * Membership Unlock Sequence — ceremonial transition from customer to member.
 * Cinematic, slow, confident. Triggered after successful Stripe Checkout.
 */

export type UnlockSequencePhase =
  | "fade"
  | "lock"
  | "keyApproach"
  | "keyTurn"
  | "unlock"
  | "burst"
  | "welcomeOne"
  | "welcomeTwo"
  | "portal"
  | "done";

export type UnlockTimingProfile = "full" | "fast";

export interface MembershipUnlockContext {
  homeownerFirstName: string;
  homeownerFullName: string;
  propertyName: string;
  propertySlug: string;
  homeownerSlug: string;
  propertyHeroImage: string;
  planName: string;
}

export interface UnlockPlaybackOptions {
  /** Replay the full ceremony even if already seen (user opt-in) */
  forceReplay?: boolean;
  /** Override production timing profile */
  profile?: UnlockTimingProfile;
}

export type UnlockPlayback =
  | { action: "ceremony"; profile: UnlockTimingProfile }
  | { action: "skip" };

/** ~11s — first-time signature moment (default) */
export const UNLOCK_TIMING_FULL = {
  fade: 800,
  lockAppear: 1200,
  pauseBeforeKey: 700,
  keyApproach: 1500,
  keyTurn: 1000,
  lockOpen: 900,
  lightBloom: 2000,
  welcomeOne: 2200,
  welcomeBreath: 1400,
  welcomeTwo: 2600,
  portalHandoff: 900,
  skipAvailableAfter: 1500,
} as const;

/** ~5.6s — production fast mode for real customers */
export const UNLOCK_TIMING_FAST = {
  fade: 350,
  lockAppear: 500,
  pauseBeforeKey: 300,
  keyApproach: 650,
  keyTurn: 500,
  lockOpen: 400,
  lightBloom: 700,
  welcomeOne: 900,
  welcomeBreath: 600,
  welcomeTwo: 1100,
  portalHandoff: 400,
  skipAvailableAfter: 1500,
} as const;

export const UNLOCK_WELCOME_COPY = {
  family: "Welcome to the SqueegeeKing Family.",
  care: "Your home is now under our care.",
} as const;

export const MEMBER_WELCOME_SESSION_KEY = "squeegeeking:member-welcome";
const CEREMONY_SEEN_PREFIX = "squeegeeking:unlock-seen:";

export function getUnlockTiming(profile: UnlockTimingProfile) {
  return profile === "fast" ? UNLOCK_TIMING_FAST : UNLOCK_TIMING_FULL;
}

export function getUnlockSequenceTotalMs(profile: UnlockTimingProfile): number {
  const t = getUnlockTiming(profile);
  return (
    t.fade +
    t.lockAppear +
    t.pauseBeforeKey +
    t.keyApproach +
    t.keyTurn +
    t.lockOpen +
    t.lightBloom +
    t.welcomeOne +
    t.welcomeBreath +
    t.welcomeTwo +
    t.portalHandoff
  );
}

/**
 * Production timing: set NEXT_PUBLIC_UNLOCK_TIMING=fast on Vercel for ~5–6s ceremony.
 * Default (unset or "full") keeps the ~11s signature moment.
 */
export function getProductionUnlockTimingProfile(): UnlockTimingProfile {
  const value = process.env.NEXT_PUBLIC_UNLOCK_TIMING;
  return value === "fast" ? "fast" : "full";
}

function ceremonyStorageKey(homeownerSlug: string, propertySlug: string): string {
  return `${CEREMONY_SEEN_PREFIX}${homeownerSlug}:${propertySlug}`;
}

export function hasSeenUnlockCeremony(
  homeownerSlug: string,
  propertySlug: string,
): boolean {
  if (typeof window === "undefined") return false;
  return (
    localStorage.getItem(ceremonyStorageKey(homeownerSlug, propertySlug)) ===
    "1"
  );
}

export function markUnlockCeremonySeen(
  homeownerSlug: string,
  propertySlug: string,
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    ceremonyStorageKey(homeownerSlug, propertySlug),
    "1",
  );
}

/**
 * First activation → ceremony (full or fast per env).
 * Return visits → skip straight to portal unless forceReplay.
 */
export function resolveUnlockPlayback(
  context: MembershipUnlockContext,
  options?: UnlockPlaybackOptions,
): UnlockPlayback {
  if (
    !options?.forceReplay &&
    hasSeenUnlockCeremony(context.homeownerSlug, context.propertySlug)
  ) {
    return { action: "skip" };
  }

  const profile =
    options?.profile ??
    (options?.forceReplay ? "full" : getProductionUnlockTimingProfile());

  return { action: "ceremony", profile };
}

export function buildWelcomeMessage(firstName: string): string {
  const name = firstName.trim() || "friend";
  return `Welcome home, ${name}.`;
}

export function buildMemberPortalPath(
  homeownerSlug: string,
  propertySlug?: string,
): string {
  if (propertySlug) {
    return `/homecare/${homeownerSlug}/${propertySlug}/portal`;
  }
  return `/homecare/${homeownerSlug}`;
}

export function unlockContextFromPlanData(
  planData: {
    homeowner: { firstName: string; fullName: string; slug: string };
    property: { name: string; slug: string; heroImage: string };
  },
  planName: string,
): MembershipUnlockContext {
  return {
    homeownerFirstName: planData.homeowner.firstName,
    homeownerFullName: planData.homeowner.fullName,
    propertyName: planData.property.name,
    propertySlug: planData.property.slug,
    homeownerSlug: planData.homeowner.slug,
    propertyHeroImage: planData.property.heroImage,
    planName,
  };
}

export function markMemberWelcomePending(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(MEMBER_WELCOME_SESSION_KEY, Date.now().toString());
}

export function consumeMemberWelcomePending(): boolean {
  if (typeof window === "undefined") return false;
  const value = sessionStorage.getItem(MEMBER_WELCOME_SESSION_KEY);
  if (!value) return false;
  sessionStorage.removeItem(MEMBER_WELCOME_SESSION_KEY);
  return true;
}

/** @deprecated Use getUnlockTiming(profile) */
export const UNLOCK_SEQUENCE_TIMING = UNLOCK_TIMING_FULL;
