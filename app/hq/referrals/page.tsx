import type { Metadata } from "next";
import { HqReferralsPage } from "@/components/admin/hq-referrals-page";

export const metadata: Metadata = {
  title: "Referrals · Headquarters",
  robots: { index: false, follow: false },
};

export default function ReferralsPage() {
  return <HqReferralsPage />;
}
