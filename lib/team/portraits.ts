import type { FounderPortraitVariant } from "./types";

/**
 * Convention-based portrait paths.
 *
 * When Noah uploads professional photos, place them here (WebP preferred):
 *   public/team/noah-thomas/portrait-full.webp
 *   public/team/noah-thomas/portrait-desktop.webp
 *   public/team/noah-thomas/portrait-mobile.webp
 *   public/team/dasan-gramps/portrait-full.webp
 *   …etc.
 *
 * No code changes required — components detect load failure and show placeholders
 * until files exist. Once files are present, every surface updates automatically.
 */
const PORTRAIT_FILENAMES: Record<FounderPortraitVariant, string> = {
  full: "portrait-full.webp",
  desktop: "portrait-desktop.webp",
  mobile: "portrait-mobile.webp",
};

export function getFounderPortraitPath(
  slug: string,
  variant: FounderPortraitVariant,
): string {
  return `/team/${slug}/${PORTRAIT_FILENAMES[variant]}`;
}

export function getFounderSignaturePath(slug: string): string {
  return `/team/${slug}/signature.webp`;
}

/** Next/Image sizes hints per layout context */
export const PORTRAIT_IMAGE_SIZES = {
  card: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 480px",
  hero: "(max-width: 768px) 100vw, 50vw",
  compact: "120px",
} as const;
