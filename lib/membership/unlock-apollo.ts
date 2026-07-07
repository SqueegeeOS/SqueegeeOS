/**
 * Unlock Ceremony — Apollo Motion Spec v2.0
 * Easing, timing, and welcome copy for the membership unlock sequence.
 */

import { CUSTOMER_BRAND } from "@/lib/brand/customer";
import { PLATFORM_BRAND } from "@/lib/brand/platform";
import type { MembershipUnlockContext } from "./unlock-sequence";

export type ApolloParticlePhase = "ambient" | "constellation" | "orbit" | "illuminate";

export const APOLLO_COLORS = {
  darker: "#060609",
  warmWhite: "#fdfcfa",
} as const;

export const APOLLO_BENEFITS = [
  "Priority Scheduling",
  "Premium Member Pricing",
  "Complimentary Rain Guarantee",
  "Dedicated Home History",
  "Personalized Maintenance Timeline",
] as const;

/** Scale all ceremony delays/durations (fast ≈ 55%) */
export function apolloTime(ms: number, profile: "full" | "fast"): number {
  return profile === "fast" ? Math.round(ms * 0.55) : ms;
}

/** Rough total before portal handoff (full profile) */
export const APOLLO_CEREMONY_ESTIMATE_MS = 28_000;

export function getApolloCeremonyEstimateMs(profile: "full" | "fast"): number {
  return apolloTime(APOLLO_CEREMONY_ESTIMATE_MS, profile);
}

export const apolloEase = {
  outExpo: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  outQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  inOutQuart: (t: number) =>
    t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  outElasticSoft: (t: number) => {
    const c4 = (2 * Math.PI) / 6;
    return t === 0
      ? 0
      : t === 1
        ? 1
        : Math.pow(2, -8 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  inQuart: (t: number) => t * t * t * t,
};

export function apolloAnimate(
  duration: number,
  onUpdate: (t: number, raw: number) => void,
  onComplete?: () => void,
  easingFn: (t: number) => number = apolloEase.inOutCubic,
): () => void {
  const start = performance.now();
  let frameId = 0;
  let cancelled = false;

  function frame(now: number) {
    if (cancelled) return;
    const elapsed = now - start;
    const raw = Math.min(elapsed / duration, 1);
    const t = easingFn(raw);
    onUpdate(t, raw);
    if (raw < 1) {
      frameId = requestAnimationFrame(frame);
    } else {
      onComplete?.();
    }
  }

  frameId = requestAnimationFrame(frame);

  return () => {
    cancelled = true;
    cancelAnimationFrame(frameId);
  };
}

export function apolloDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function apolloFadeIn(
  el: HTMLElement,
  duration: number,
  targetOpacity = 1,
  easingFn: (t: number) => number = apolloEase.outCubic,
): Promise<void> {
  return new Promise((resolve) => {
    el.style.opacity = "0";
    apolloAnimate(
      duration,
      (t) => {
        el.style.opacity = (t * targetOpacity).toString();
      },
      resolve,
      easingFn,
    );
  });
}

export interface ApolloWelcomeContent {
  eyebrow: string;
  headlinePrimary: string;
  headlineEmphasis: string;
  headlineSecondary: string;
  subtitle: string;
  statementOne: string;
  statementTwo: string;
  emblem: string;
  finalLine: string;
}

export function buildApolloWelcomeContent(
  context: MembershipUnlockContext,
): ApolloWelcomeContent {
  const firstName = context.homeownerFirstName.trim() || "Member";
  return {
    eyebrow: `${PLATFORM_BRAND.name} · Private Membership`,
    headlinePrimary: `Welcome, ${firstName}.`,
    headlineEmphasis: "Your Personalized Home Care",
    headlineSecondary: "Membership is Active.",
    subtitle: `${context.propertyName} now has a dedicated maintenance plan built around your home — ${context.planName}.`,
    statementOne: "You're no longer booking appointments.",
    statementTwo: "You're protecting your home.",
    emblem: PLATFORM_BRAND.name,
    finalLine: "Welcome Home.",
  };
}

export const APOLLO_SERVICE_LABEL = CUSTOMER_BRAND.name;
