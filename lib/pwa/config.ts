/** Shared PWA configuration — HomeAtlas member portal */
import { PLATFORM_BRAND } from "@/lib/brand/platform";

export const pwaConfig = {
  name: PLATFORM_BRAND.name,
  shortName: PLATFORM_BRAND.name,
  description: "Your home's care record — visits, health, and membership in one place.",
  themeColor: "#060606",
  backgroundColor: "#060606",
  /** Generic fallback only — portal pages serve per-member manifests. */
  startUrl: "/portal",
  scope: "/",
  display: "standalone" as const,
} as const;
