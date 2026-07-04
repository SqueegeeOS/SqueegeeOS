import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PropertyDashboard } from "@/components/property/dashboard/property-dashboard";
import {
  getAllPropertySlugs,
  getPropertyBySlug,
} from "@/lib/property/types";
import { platformPageTitle, PLATFORM_BRAND } from "@/lib/brand/platform";
import { propertyHubContext } from "@/lib/property/mock-data";

interface PropertyPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllPropertySlugs(propertyHubContext).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PropertyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const property = getPropertyBySlug(propertyHubContext, slug);

  if (!property) {
    return { title: platformPageTitle("Property Not Found") };
  }

  return {
    title: `${property.name} | ${PLATFORM_BRAND.name}`,
    description: property.narrative,
  };
}

export default async function PropertyPage({ params }: PropertyPageProps) {
  const { slug } = await params;
  const property = getPropertyBySlug(propertyHubContext, slug);

  if (!property) {
    notFound();
  }

  return <PropertyDashboard property={property} />;
}
