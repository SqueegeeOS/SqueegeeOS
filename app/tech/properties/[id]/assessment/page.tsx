import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PropertyAssessmentTool } from "@/components/assessment/PropertyAssessmentTool";
import { getPropertyHealthHeader } from "@/lib/health/repository";
import { requireFieldPropertyPageActor } from "@/lib/field-operations/field-access-dal";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Property Assessment | Technician",
};

interface TechPropertyAssessmentPageProps {
  params: Promise<{ id: string }>;
}

export default async function TechPropertyAssessmentPage({
  params,
}: TechPropertyAssessmentPageProps) {
  const { id } = await params;
  const actor = await requireFieldPropertyPageActor(
    id,
    `/tech/properties/${id}/assessment`,
  );
  if (actor.kind === "technician") redirect("/tech?use=field-closeout");
  const property = await getPropertyHealthHeader(id);

  if (!property) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm text-[#555]">Property not found.</p>
        <Link href="/tech/properties" className="mt-4 inline-block text-sm text-[#c9a96e]">
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
      <Suspense
        fallback={
          <div className="py-16 text-center text-sm text-[#555]">Loading…</div>
        }
      >
        <PropertyAssessmentTool
          propertyId={id}
          propertyName={property.name}
          propertyAddress={addressLine || undefined}
          cancelHref={propertyPath}
        />
      </Suspense>
    </div>
  );
}
