/**
 * Headquarters boot choreography — restrained, hierarchical, fast enough to work daily.
 */
export const HQ_BOOT_LAYERS = {
  ambient: 0,
  navigation: 0.08,
  morningBrief: 0.18,
  reviews: 0.22,
  statCards: 0.28,
  charts: 0.34,
  missions: 0.38,
  sections: 0.42,
  footer: 0.48,
  settle: 0.55,
} as const;

/** After arrival ceremony — metrics only, no repeated hero theater. */
export const HQ_BOOT_LAYERS_SETTLE = {
  ambient: 0,
  navigation: 0,
  morningBrief: 0.06,
  reviews: 0.08,
  statCards: 0.1,
  charts: 0.14,
  missions: 0.16,
  sections: 0.18,
  footer: 0,
  settle: 0.22,
} as const;

export type BootLayerKey = keyof typeof HQ_BOOT_LAYERS;

export type MotionProfile = "full" | "settle" | "none";

export const HQ_BOOT_DURATION_MS = 1600;
export const HQ_BOOT_DURATION_SETTLE_MS = 450;

export function bootLayerDelay(
  layer: BootLayerKey,
  staggerIndex = 0,
  profile: MotionProfile = "full",
): number {
  if (profile === "none") return 0;

  const table =
    profile === "settle" ? HQ_BOOT_LAYERS_SETTLE : HQ_BOOT_LAYERS;
  const stagger = profile === "settle" ? 0.04 : 0.055;
  return table[layer] + staggerIndex * stagger;
}

export function bootDurationMs(profile: MotionProfile): number {
  if (profile === "none") return 0;
  if (profile === "settle") return HQ_BOOT_DURATION_SETTLE_MS;
  return HQ_BOOT_DURATION_MS;
}

/** Single welcome line for HQ — both founders, one voice. */
export function headquartersWelcomeLine(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning, Noah & Dasan.";
  if (hour < 17) return "Good afternoon, Noah & Dasan.";
  return "Good evening, Noah & Dasan.";
}

export const HQ_SESSION_BOOT_KEY = "squeegeeking:hq-session-booted";

export function shouldRunHeadquartersBoot(): boolean {
  if (typeof window === "undefined") return true;
  return sessionStorage.getItem(HQ_SESSION_BOOT_KEY) !== "1";
}

export function markHeadquartersBootComplete(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(HQ_SESSION_BOOT_KEY, "1");
}

export function clearHeadquartersBootFlag(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(HQ_SESSION_BOOT_KEY);
}
