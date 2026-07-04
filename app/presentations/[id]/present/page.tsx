import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PresentationViewer } from "@/components/presentations/presentation-viewer";
import { getPresentation } from "@/lib/presentations/repository";
import { platformPageTitle } from "@/lib/brand/platform";

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
  const presentation = await getPresentation(id);
  if (!presentation) notFound();

  return <PresentationViewer presentation={presentation} />;
}
