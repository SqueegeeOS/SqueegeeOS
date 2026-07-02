/**
 * Squeegeeking leadership — single source of truth for all founder content.
 *
 * POLICY: All customer-facing people must be real Squeegeeking team members
 * or clearly marked portrait placeholders. Never use stock photos or fictional names.
 *
 * PHOTO WORKFLOW:
 * 1. Upload portraits to public/team/{slug}/ (see lib/team/portraits.ts)
 * 2. Placeholders swap to real photos automatically — no other code changes
 *
 * Surfaces: Landing, Meet the Founders, Home Care Plans, Homeowner Portal,
 * About (future), Team page (future), Employee Dashboard (where appropriate).
 */

import { getFounderPortraitPath } from "./portraits";
import type { FounderProfile, PortraitPlaceholderKind } from "./types";

export const SQUEEGEEKING_FOUNDERS: FounderProfile[] = [
  {
    id: "noah-thomas",
    slug: "noah-thomas",
    name: "Noah Thomas",
    role: "Founder & Visionary",
    bio: "SqueegeeKing was founded to raise the standard of exterior home care. Noah focuses on customer experience, systems, technology, long-term relationships, and building a company homeowners genuinely trust.",
    quote:
      "We don't just clean windows. We help homeowners care for their property year after year.",
    portraitPlaceholder: "founder",
    socialLinks: {},
    signaturePath: null,
  },
  {
    id: "dasan-gramps",
    slug: "dasan-gramps",
    name: "Dasan Gramps",
    role: "Co-Founder & Chief Operations Officer",
    bio: "Dasan has been one of Noah's closest friends since high school and later joined SqueegeeKing to help build the company. He leads daily operations, crew standards, quality control, and helps ensure every customer receives a premium experience.",
    quote: "Do it right. Keep improving. Take care of the customer.",
    portraitPlaceholder: "team",
    socialLinks: {},
    signaturePath: null,
  },
];

export const NOAH_PERSONAL_NOTE = {
  signoff: "Noah",
  title: "Founder & Visionary",
  company: "SqueegeeKing",
} as const;

export function getFounderById(id: string): FounderProfile | undefined {
  return SQUEEGEEKING_FOUNDERS.find((f) => f.id === id);
}

export function getFounderBySlug(slug: string): FounderProfile | undefined {
  return SQUEEGEEKING_FOUNDERS.find((f) => f.slug === slug);
}

export function getPlaceholderLabel(kind: PortraitPlaceholderKind): string {
  return kind === "founder"
    ? "Founder portrait coming soon."
    : "Team portrait coming soon.";
}

/** Resolve portrait src for a founder — convention path, auto-used by FounderPortrait */
export function resolveFounderPortraitSrc(
  founder: FounderProfile,
  variant: "desktop" | "mobile" | "full" = "desktop",
): string {
  return getFounderPortraitPath(founder.slug, variant);
}

/** Home Care Plan JSON shape — references central founders at render time */
export function foundersAsPlanTeam(): Array<{
  id: string;
  slug: string;
  name: string;
  role: string;
  bio: string;
  image: null;
  quote?: string;
}> {
  return SQUEEGEEKING_FOUNDERS.map((founder) => ({
    id: founder.id,
    slug: founder.slug,
    name: founder.name,
    role: founder.role,
    bio: founder.bio,
    image: null,
    quote: founder.quote,
  }));
}
