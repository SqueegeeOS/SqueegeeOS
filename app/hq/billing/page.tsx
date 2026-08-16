import type { Metadata } from "next";
import { BillingWorkspacePage } from "@/components/admin/billing-workspace-page";
import { resolveBillingWorkspaceFocus } from "@/lib/admin/billing-workspace-links";
import { PLATFORM_BRAND } from "@/lib/brand/platform";

export const metadata: Metadata = {
  title: `Billing | Headquarters | SqueegeeKing`,
  description: `Manual billing operations for ${PLATFORM_BRAND.name} memberships.`,
  robots: {
    index: false,
    follow: false,
  },
};

export default async function HqBillingPage({
  searchParams,
}: {
  searchParams: Promise<{
    membership?: string | string[];
    appointment?: string | string[];
    returnTo?: string | string[];
  }>;
}) {
  const focus = resolveBillingWorkspaceFocus(await searchParams);
  return <BillingWorkspacePage focus={focus} />;
}
