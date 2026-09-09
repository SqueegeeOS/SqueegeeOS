import type { Metadata } from "next";
import { GrowthOperatingLoopPage } from "@/components/admin/growth-operating-loop-page";

export const metadata: Metadata = {
  title: "Growth Engine | Headquarters | SqueegeeKing",
  description:
    "Private operating view for sales velocity, independent production, and recurring ARR growth.",
  robots: { index: false, follow: false },
};

export default function HqGrowthPage() {
  return <GrowthOperatingLoopPage />;
}
