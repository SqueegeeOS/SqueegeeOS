/** Portrait crops — files live under /public/team/{slug}/ */
export type FounderPortraitVariant = "full" | "desktop" | "mobile";

export type PortraitPlaceholderKind = "founder" | "team";

export interface FounderSocialLinks {
  linkedin?: string;
  instagram?: string;
  website?: string;
}

/**
 * Central founder profile — single source for all surfaces.
 * Update bios here; drop photos in public/team/{slug}/ to replace placeholders everywhere.
 */
export interface FounderProfile {
  id: string;
  slug: string;
  name: string;
  role: string;
  bio: string;
  quote?: string;
  /** Placeholder copy when portraits are not yet uploaded */
  portraitPlaceholder: PortraitPlaceholderKind;
  socialLinks?: FounderSocialLinks;
  /** Optional signature image path — /team/{slug}/signature.webp */
  signaturePath: string | null;
}

export const PORTRAIT_ASPECT = {
  /** Standard founder card — desktop & plan sections */
  card: 4 / 5,
  /** Tighter mobile portrait */
  mobile: 3 / 4,
  /** Landing hero / large feature */
  hero: 5 / 6,
} as const;
