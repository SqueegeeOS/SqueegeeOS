import type { Metadata } from "next";
import { GrowthCommandCenterPage } from "@/components/admin/growth-command-center-page";

export const metadata: Metadata = {
  title: "Growth Planning Lab | Headquarters | SqueegeeKing",
  description:
    "Detailed ARR scenarios, historical owner-buyback planning, and advanced growth experiments.",
  robots: { index: false, follow: false },
};

export default function HqGrowthPlanningPage() {
  return <GrowthCommandCenterPage />;
}
