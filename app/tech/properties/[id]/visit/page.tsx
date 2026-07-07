import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DocumentVisitForm } from "@/components/visit/DocumentVisitForm";
import { getPropertyHealthHeader } from "@/lib/health/repository";

export const metadata: Metadata = {
  title: "Document Visit | Technician",
};

interface TechDocumentVisitPageProps {
  params: Promise<{ id: string }>;
}

export default async function TechDocumentVisitPage({
  params,
}: TechDocumentVisitPageProps) {
  const { id } = await params;
  const property = await getPropertyHealthHeader(id);

  if (!property) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm text-[#555]">Property not found.</p>
        <Link href="/tech" className="mt-4 inline-block text-sm text-[#c9a96e]">
          ← All properties
        </Link>
      </div>
    );
  }

  const propertyPath = `/tech/properties/${id}`;
  const addressLine = [property.address, property.customerName]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-lg px-4 py-8 pb-16">
      <Suspense
        fallback={
          <div className="py-16 text-center text-sm text-[#555]">Loading…</div>
        }
      >
        <DocumentVisitForm
          propertyId={id}
          propertyName={property.name}
          propertyAddress={addressLine || undefined}
          cancelHref={propertyPath}
          successHref={propertyPath}
          mode="tech"
        />
      </Suspense>
    </div>
  );
}
