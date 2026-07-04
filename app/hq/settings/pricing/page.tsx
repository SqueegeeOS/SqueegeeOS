import type { Metadata } from "next";
import { PricingSettingsStubPage } from "@/components/admin/pricing-settings-stub-page";

export const metadata: Metadata = {
  title: "Pricing Settings | HomeAtlas HQ",
  description: "Atlas Pricing Engine company settings (stub).",
  robots: { index: false, follow: false },
};

export default function HqPricingSettingsRoute() {
  return <PricingSettingsStubPage />;
}
