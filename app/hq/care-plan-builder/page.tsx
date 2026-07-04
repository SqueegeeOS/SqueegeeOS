import type { Metadata } from "next";
import { CarePlanBuilderPage } from "@/components/admin/care-plan-builder-page";

export const metadata: Metadata = {
  title: "Home Care Plan Builder | SqueegeeKing HQ",
  description: "Standard Pricing Engine for window care quotes.",
  robots: { index: false, follow: false },
};

export default function HqCarePlanBuilderRoute() {
  return <CarePlanBuilderPage />;
}
