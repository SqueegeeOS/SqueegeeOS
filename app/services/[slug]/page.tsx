import type { Metadata } from "next";
import { buildPublicPageMetadata } from "@/lib/marketing/page-metadata";
import { notFound } from "next/navigation";
import { ServiceDetailPage } from "@/components/marketing/service-detail-page";
import {
  getPublicService,
  PUBLIC_SERVICES,
} from "@/lib/marketing/public-services";

interface ServicePageProps {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return PUBLIC_SERVICES.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({
  params,
}: ServicePageProps): Promise<Metadata> {
  const { slug } = await params;
  const service = getPublicService(slug);

  if (!service) return {};

  return buildPublicPageMetadata({
    title: service.pageTitle,
    description: service.metaDescription,
    path: `/services/${service.slug}`,
    image: {
      url: service.image,
      width: 1376,
      height: 768,
      alt: service.imageAlt,
    },
  });
}

export default async function PublicServicePage({ params }: ServicePageProps) {
  const { slug } = await params;
  const service = getPublicService(slug);

  if (!service) notFound();

  return <ServiceDetailPage service={service} />;
}
