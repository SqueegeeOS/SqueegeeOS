/** Shared PWA configuration */
import { CUSTOMER_BRAND } from "@/lib/brand/customer";

export const pwaConfig = {
  name: CUSTOMER_BRAND.name,
  shortName: CUSTOMER_BRAND.name,
  description: CUSTOMER_BRAND.tagline,
  themeColor: "#060606",
  backgroundColor: "#060606",
  startUrl: "/",
  display: "standalone" as const,
} as const;
