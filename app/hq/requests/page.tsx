import type { Metadata } from "next";
import { PendingRequestsPage } from "@/components/admin/pending-requests-page";
import { PLATFORM_BRAND } from "@/lib/brand/platform";

export const metadata: Metadata = {
  title: `Requests | ${PLATFORM_BRAND.name}`,
  description: "Founder inbox for public home care requests.",
  robots: { index: false, follow: false },
};

export default function HqPendingRequestsPage() {
  return <PendingRequestsPage />;
}
