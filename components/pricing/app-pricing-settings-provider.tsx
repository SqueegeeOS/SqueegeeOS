"use client";

import { usePathname } from "next/navigation";
import { PricingSettingsProvider } from "@/components/pricing/pricing-settings-provider";
import { isPortalRoute } from "@/lib/pricing/pricing-settings-path";

export function AppPricingSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/";

  if (isPortalRoute(pathname)) {
    return children;
  }

  return <PricingSettingsProvider>{children}</PricingSettingsProvider>;
}
