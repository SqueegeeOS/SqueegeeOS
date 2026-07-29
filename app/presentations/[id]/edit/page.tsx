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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PresentationEditorLoader id={id} />;
}
