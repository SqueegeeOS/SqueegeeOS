import type { Metadata } from "next";
import { CUSTOMER_BRAND } from "@/lib/brand/customer";
import { LarryBuckleyExperience } from "@/components/homecare/larry-buckley/experience";

export const metadata: Metadata = {
  title: `Larry Buckley — Home Care Experience | ${CUSTOMER_BRAND.name}`,
  description:
    "A personalized luxury home care experience crafted for Larry Buckley and 1847 Vallejo Street.",
};

export default function LarryBuckleyPage() {
  return <LarryBuckleyExperience />;
}
