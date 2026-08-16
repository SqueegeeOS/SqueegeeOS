import type { Metadata } from "next";
import { PresentationEditorLoader } from "@/components/presentations/presentation-editor-loader";
import { platformPageTitle } from "@/lib/brand/platform";
import {
  fieldWorkspaceReturnPath,
  presentationEditorPath,
} from "@/lib/presentations/navigation";
import { requireSalesPresentationPageActor } from "@/lib/sales/sales-access-dal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: platformPageTitle("Edit Presentation"),
  robots: { index: false, follow: false },
};

export default async function EditPresentationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    inquirySync?: string | string[];
    returnTo?: string | string[];
  }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const returnTo = fieldWorkspaceReturnPath(query.returnTo);
  await requireSalesPresentationPageActor(
    id,
    presentationEditorPath(id, { returnTo }),
  );
  return (
    <PresentationEditorLoader
      id={id}
      inquirySyncPending={query.inquirySync === "pending"}
      returnTo={returnTo}
      preauthorized
    />
  );
}
