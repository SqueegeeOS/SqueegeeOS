import type { Metadata } from "next";
import { PendingRequestDetailPage } from "@/components/admin/pending-request-detail-page";
import { PLATFORM_BRAND } from "@/lib/brand/platform";

export const metadata: Metadata = {
  title: `Request | ${PLATFORM_BRAND.name}`,
  robots: { index: false, follow: false },
};

export default async function HqPendingRequestDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PendingRequestDetailPage id={id} />;
}
