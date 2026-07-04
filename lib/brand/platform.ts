/** Platform brand — HomeAtlas (user-facing only; internal code names unchanged). */
export const PLATFORM_BRAND = {
  name: "HomeAtlas",
  tagline: "The Operating System for Home Service Companies.",
  /** Internal codename for the AI concierge layer */
  conciergeCodename: "Atlas",
  morningBriefEyebrow: "HomeAtlas",
  morningBriefTitle: "HomeAtlas Morning Brief",
  poweredByLabel: "Powered by HomeAtlas",
} as const;

export function platformPageTitle(page: string): string {
  return `${page} | ${PLATFORM_BRAND.name}`;
}
