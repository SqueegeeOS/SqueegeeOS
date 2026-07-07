/** Shared PWA configuration — HomeAtlas member portal */
import { PLATFORM_BRAND } from "@/lib/brand/platform";

export const pwaConfig = {
  name: PLATFORM_BRAND.name,
  shortName: PLATFORM_BRAND.name,
  description: "Your home's care record — visits, health, and membership in one place.",
  themeColor: "#060606",
  backgroundColor: "#060606",
  /** PWA opens portal entry; stored token resolves to /portal/[token] */
  startUrl: "/portal",
  scope: "/portal",
  display: "standalone" as const,
} as const;
