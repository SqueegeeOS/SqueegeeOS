/**
 * Membership Unlock Sequence — ceremonial transition from customer to member.
 * Triggered after successful Stripe Checkout (mock or live).
 */

export type UnlockSequencePhase =
  | "fade"
  | "lock"
  | "key"
  | "turn"
  | "open"
  | "burst"
  | "portal"
  | "done";

export interface MembershipUnlockContext {
  homeownerFirstName: string;
  homeownerFullName: string;
  propertyName: string;
  propertySlug: string;
  homeownerSlug: string;
  propertyHeroImage: string;
  planName: string;
}

/** Milliseconds — full sequence ~3.2s before navigation to Member Portal */
export const UNLOCK_SEQUENCE_TIMING = {
  fade: 400,
  lockAppear: 600,
  pauseBeforeKey: 300,
  keyGlide: 500,
  keyTurn: 350,
  lockOpen: 250,
  lightBurst: 450,
  portalReveal: 350,
  skipAvailableAfter: 1000,
  maxDuration: 3200,
} as const;

export function getUnlockSequenceTotalMs(): number {
  const t = UNLOCK_SEQUENCE_TIMING;
  return (
    t.fade +
    t.lockAppear +
    t.pauseBeforeKey +
    t.keyGlide +
    t.keyTurn +
    t.lockOpen +
    t.lightBurst +
    t.portalReveal
  );
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
