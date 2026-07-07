import type { Metadata } from "next";
import { PropertyHealthPageShell } from "@/components/hq/property-health-page-shell";

export const metadata: Metadata = {
  title: "Property Health | HQ",
  robots: { index: false, follow: false },
};

interface PropertyHealthPageProps {
  params: Promise<{ id: string }>;
}

export default async function PropertyHealthPage({
  params,
}: PropertyHealthPageProps) {
  const { id } = await params;
  return <PropertyHealthPageShell propertyId={id} />;
}
