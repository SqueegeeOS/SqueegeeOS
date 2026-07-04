import type { Metadata } from "next";
import { PricingSettingsPage } from "@/components/admin/pricing-settings-page";

export const metadata: Metadata = {
  title: "Pricing Settings | HomeAtlas HQ",
  description: "Edit Atlas Pricing Engine company settings.",
  robots: { index: false, follow: false },
};

export default function HqPricingSettingsRoute() {
  return <PricingSettingsPage />;
}
