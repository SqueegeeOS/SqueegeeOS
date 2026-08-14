import type { Metadata } from "next";
import { GrowthCommandCenterPage } from "@/components/admin/growth-command-center-page";

export const metadata: Metadata = {
  title: "Growth Command Center | Headquarters | SqueegeeKing",
  description: "Private source-backed ARR growth planning for SqueegeeKing.",
  robots: { index: false, follow: false },
};

export default function HqGrowthPage() {
  return <GrowthCommandCenterPage />;
}
