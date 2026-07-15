import type { Metadata } from "next";
import { PresentationPresentLoader } from "@/components/presentations/presentation-present-loader";
import { getPresentationByCapability } from "@/lib/presentations/repository";
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
  const presentation = await getPresentationByCapability(id);

  return <PresentationPresentLoader id={id} initial={presentation} />;
}
