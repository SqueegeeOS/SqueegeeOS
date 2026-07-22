import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PresentationEditor } from "@/components/presentations/presentation-editor";
import { getPresentation } from "@/lib/presentations/repository";
import { platformPageTitle } from "@/lib/brand/platform";
import { requireHqPage } from "@/lib/auth/require-hq-page";

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
  await requireHqPage(`/presentations/${id}/edit`);
  const presentation = await getPresentation(id);
  if (!presentation) notFound();

  return <PresentationEditor presentation={presentation} />;
}
