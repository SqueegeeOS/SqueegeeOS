import type { Metadata } from "next";
import { PricingCalculatorPage } from "@/components/admin/pricing-calculator-page";

export const metadata: Metadata = {
  title: "Pricing Calculator | SqueegeeKing HQ",
  description: "Base quarterly and one-time pricing by square footage.",
  robots: { index: false, follow: false },
};

export default function HqPricingPage() {
  return <PricingCalculatorPage />;
}
