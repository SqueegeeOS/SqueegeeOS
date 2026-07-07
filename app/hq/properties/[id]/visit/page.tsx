import type { Metadata } from "next";
import { DocumentVisitPageShell } from "@/components/visit/document-visit-page-shell";
import { getPropertyHealthHeader } from "@/lib/health/repository";

export const metadata: Metadata = {
  title: "Document Visit | HQ",
  robots: { index: false, follow: false },
};

interface HqDocumentVisitPageProps {
  params: Promise<{ id: string }>;
}

export default async function HqDocumentVisitPage({
  params,
}: HqDocumentVisitPageProps) {
  const { id } = await params;
  const property = await getPropertyHealthHeader(id);

  if (!property) {
    return (
      <div className="mx-auto min-h-screen max-w-lg bg-[#0a0a0a] px-4 py-16 text-center text-white">
        <p className="text-sm text-[#666]">Property not found.</p>
      </div>
    );
  }

  const addressLine = [property.address, property.customerName]
    .filter(Boolean)
    .join(" · ");

  return (
    <DocumentVisitPageShell
      propertyId={id}
      propertyName={property.name}
      propertyAddress={addressLine || undefined}
    />
  );
}
