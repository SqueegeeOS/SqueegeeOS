/**
 * Membership Unlock Sequence — Daedalus Motion Spec v1.
 * Triggered after successful Stripe Checkout.
 */

import {
  getDaedalusTotalMs,
  scaleDaedalusPhases,
} from "./unlock-daedalus";

export type UnlockSequencePhase =
  | "approach"
  | "insert"
  | "turn"
  | "release"
  | "bloom"
  | "reveal"
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

/** Daedalus v1 — 4000ms full ceremony */
export const UNLOCK_TIMING_FULL = scaleDaedalusPhases(1);

/** ~2200ms — same choreography, compressed */
export const UNLOCK_TIMING_FAST = scaleDaedalusPhases(0.55);

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
  return getDaedalusTotalMs(profile);
}

/**
 * Production timing: set NEXT_PUBLIC_UNLOCK_TIMING=fast on Vercel for ~2.2s ceremony.
 * Default (unset or "full") keeps the 4s Daedalus v1 spec.
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
