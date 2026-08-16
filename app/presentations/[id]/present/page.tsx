import type { Metadata } from "next";
import { PresentationPresentLoader } from "@/components/presentations/presentation-present-loader";
import { platformPageTitle } from "@/lib/brand/platform";
import { requireSalesPresentationPageActor } from "@/lib/sales/sales-access-dal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: platformPageTitle("Present"),
  robots: { index: false, follow: false },
};

export default async function PresentPresentationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireSalesPresentationPageActor(id, `/presentations/${id}/present`);
  return <PresentationPresentLoader id={id} preauthorized />;
}
