/**
 * Headquarters boot choreography — nothing appears all at once.
 * The page should feel like a luxury OS booting.
 */
export const HQ_BOOT_LAYERS = {
  ambient: 0,
  glow: 0.14,
  navigation: 0.32,
  greeting: 0.48,
  heroTitle: 0.68,
  heroSubtitle: 0.88,
  morningBrief: 1.08,
  statCards: 1.32,
  charts: 1.58,
  reviews: 1.52,
  missions: 1.78,
  sidebar: 1.42,
  sections: 1.95,
  footer: 2.35,
  settle: 2.6,
} as const;

export type BootLayerKey = keyof typeof HQ_BOOT_LAYERS;

export const HQ_BOOT_DURATION_MS = 2800;

export function bootLayerDelay(
  layer: BootLayerKey,
  staggerIndex = 0,
  reducedMotion = false,
): number {
  if (reducedMotion) return 0;
  return HQ_BOOT_LAYERS[layer] + staggerIndex * 0.075;
}

/** Time-aware greeting for HQ unlock */
export function headquartersGreeting(firstName = "Noah"): string {
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${firstName}.`;
  if (hour < 17) return `Good afternoon, ${firstName}.`;
  return `Good evening, ${firstName}.`;
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
