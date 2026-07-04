import type { Metadata } from "next";
import Link from "next/link";
import { PropertyHealthCheckForm } from "@/components/health/PropertyHealthCheckForm";
import { getPropertyHealthHeader } from "@/lib/health/repository";

export const metadata: Metadata = {
  title: "Health Check | Technician",
};

interface TechPropertyHealthCheckPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ visitId?: string }>;
}

export default async function TechPropertyHealthCheckPage({
  params,
  searchParams,
}: TechPropertyHealthCheckPageProps) {
  const { id } = await params;
  const { visitId } = await searchParams;
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
    <div className="mx-auto max-w-lg px-4 py-8">
      <PropertyHealthCheckForm
        propertyId={id}
        propertyLabel={property.name}
        propertyAddress={addressLine || undefined}
        visitId={visitId}
        cancelHref={propertyPath}
        successHref={propertyPath}
      />
    </div>
  );
}
