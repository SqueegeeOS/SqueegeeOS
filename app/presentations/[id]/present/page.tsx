import type { Metadata } from "next";
import { PresentationPresentLoader } from "@/components/presentations/presentation-present-loader";
import { platformPageTitle } from "@/lib/brand/platform";
import {
  fieldWorkspaceReturnPath,
  presentationPresentPath,
} from "@/lib/presentations/navigation";
import { requireSalesPresentationPageActor } from "@/lib/sales/sales-access-dal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: platformPageTitle("Present"),
  robots: { index: false, follow: false },
};

export default async function PresentPresentationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const returnTo = fieldWorkspaceReturnPath(query.returnTo);
  await requireSalesPresentationPageActor(
    id,
    presentationPresentPath(id, { returnTo }),
  );
  return (
    <PresentationPresentLoader id={id} returnTo={returnTo} preauthorized />
  );
}
