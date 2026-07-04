"use client";

import { PricingSettingsProvider } from "@/components/pricing/pricing-settings-provider";

export function AppPricingSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PricingSettingsProvider>{children}</PricingSettingsProvider>;
}
