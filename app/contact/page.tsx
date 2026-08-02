import type { Metadata } from "next";
import { CUSTOMER_BRAND } from "@/lib/brand/customer";
import { SQUEEGEEKING_PHONE } from "@/lib/home-care-plan/defaults";
import { ContactPageContent } from "@/components/navigation/contact-page";

export const metadata: Metadata = {
  title: "Contact",
  description: `Call ${CUSTOMER_BRAND.name} for window cleaning and exterior home care in ${CUSTOMER_BRAND.location}, or request a personalized Home Care Plan online.`,
  alternates: { canonical: "/contact" },
  openGraph: {
    title: `Contact ${CUSTOMER_BRAND.name} in ${CUSTOMER_BRAND.location}`,
    description: `Call or request a personalized window cleaning and exterior home care plan in ${CUSTOMER_BRAND.location}.`,
    url: "/contact",
    type: "website",
  },
};

export default function ContactPage({
  searchParams,
}: {
  searchParams?: Promise<{
    topic?: string;
    property?: string;
    service?: string;
  }>;
}) {
  return (
    <ContactPageWrapper searchParams={searchParams} />
  );
}

async function ContactPageWrapper({
  searchParams,
}: {
  searchParams?: Promise<{
    topic?: string;
    property?: string;
    service?: string;
  }>;
}) {
  const params = searchParams ? await searchParams : undefined;

  return (
    <ContactPageContent
      phone={SQUEEGEEKING_PHONE}
      topic={params?.topic ?? null}
      propertySlug={params?.property ?? null}
      serviceId={params?.service ?? null}
    />
  );
}
