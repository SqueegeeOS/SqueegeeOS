import type { Metadata } from "next";
import { ProductionHealthPage } from "@/components/admin/production-health-page";
import { PLATFORM_BRAND } from "@/lib/brand/platform";

export const metadata: Metadata = {
  title: `Production Health | Headquarters | SqueegeeKing`,
  description: `Production readiness checks for ${PLATFORM_BRAND.name} customer onboarding.`,
  robots: {
    index: false,
    follow: false,
  },
};

export default function HqProductionHealthPage() {
  return <ProductionHealthPage />;
}
