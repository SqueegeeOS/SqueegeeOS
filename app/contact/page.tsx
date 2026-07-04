import type { Metadata } from "next";
import { CUSTOMER_BRAND } from "@/lib/brand/customer";
import { SQUEEGEEKING_PHONE } from "@/lib/home-care-plan/defaults";
import { ROUTES } from "@/lib/navigation/config";
import { ContactPageContent } from "@/components/navigation/contact-page";

export const metadata: Metadata = {
  title: `Contact | ${CUSTOMER_BRAND.name}`,
  description: `Reach ${CUSTOMER_BRAND.name} in ${CUSTOMER_BRAND.location}.`,
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
