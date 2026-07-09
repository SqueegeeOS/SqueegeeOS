import type { Metadata } from "next";
import { BillingWorkspacePage } from "@/components/admin/billing-workspace-page";
import { PLATFORM_BRAND } from "@/lib/brand/platform";

export const metadata: Metadata = {
  title: `Billing | Headquarters | SqueegeeKing`,
  description: `Manual billing operations for ${PLATFORM_BRAND.name} memberships.`,
  robots: {
    index: false,
    follow: false,
  },
};

export default function HqBillingPage() {
  return <BillingWorkspacePage />;
}
