import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreateHomeCarePlanWizardFromProperty } from "@/components/home-care-plan/create/create-home-care-plan-wizard";
import { propertyHubContext } from "@/lib/property/mock-data";
import { getPropertyBySlug } from "@/lib/property/types";

interface HomeCarePlanPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: HomeCarePlanPageProps): Promise<Metadata> {
  const { slug } = await params;
  const property = getPropertyBySlug(propertyHubContext, slug);

  if (!property) {
    return { title: "Home Care Plan | SqueegeeOS" };
  }

  return {
    title: `Create Home Care Plan — ${property.name} | SqueegeeOS`,
    description: `Generate a bespoke Home Care Plan proposal for ${property.name}.`,
  };
}

export default async function HomeCarePlanPage({ params }: HomeCarePlanPageProps) {
  const { slug } = await params;
  const property = getPropertyBySlug(propertyHubContext, slug);

  if (!property) {
    notFound();
  }

  const { homeowner } = propertyHubContext;

  return (
    <CreateHomeCarePlanWizardFromProperty
      property={property}
      homeowner={{
        fullName: homeowner.fullName,
        firstName: homeowner.firstName,
        email: homeowner.email,
      }}
    />
  );
}
