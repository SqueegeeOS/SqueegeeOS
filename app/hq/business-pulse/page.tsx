import type { Metadata } from "next";
import { BusinessPulsePage } from "@/components/admin/business-pulse-page";

export const metadata: Metadata = {
  title: "Business Pulse | Headquarters | SqueegeeKing",
  description: "Private source-backed business intelligence for SqueegeeKing.",
  robots: { index: false, follow: false },
};

export default function HqBusinessPulsePage() {
  return <BusinessPulsePage />;
}
