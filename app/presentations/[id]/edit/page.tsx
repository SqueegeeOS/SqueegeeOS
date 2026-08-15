import type { Metadata } from "next";
import { PresentationEditorLoader } from "@/components/presentations/presentation-editor-loader";
import { platformPageTitle } from "@/lib/brand/platform";

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
  searchParams: Promise<{ inquirySync?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return (
    <PresentationEditorLoader
      id={id}
      inquirySyncPending={query.inquirySync === "pending"}
    />
  );
}
