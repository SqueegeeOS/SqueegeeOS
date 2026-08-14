import { CUSTOMER_BRAND, CUSTOMER_CONTACT } from "@/lib/brand/customer";
import { PUBLIC_SITE_URL } from "@/lib/brand/urls";
import { getGooglePlaceId } from "@/lib/reviews/config";
import { PUBLIC_SERVICES, type PublicService } from "./public-services";

export const SQUEEGEEKING_PHONE_E164 = "+15305886235";

const CHICO_SERVICE_AREA = {
  "@type": "City",
  name: "Chico",
  containedInPlace: {
    "@type": "AdministrativeArea",
    name: "California",
  },
};

export function googleBusinessProfileUrl(placeId: string): string {
  const params = new URLSearchParams({
    api: "1",
    query: CUSTOMER_BRAND.name,
    query_place_id: placeId,
  });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

export function buildLocalBusinessJsonLd() {
  const placeId = getGooglePlaceId();
  const profileUrl = placeId ? googleBusinessProfileUrl(placeId) : null;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["LocalBusiness", "HomeAndConstructionBusiness"],
        "@id": `${PUBLIC_SITE_URL}/#business`,
        name: CUSTOMER_BRAND.name,
        legalName: "Squeegeeking LLC",
        url: PUBLIC_SITE_URL,
        telephone: SQUEEGEEKING_PHONE_E164,
        description:
          "Window cleaning, pressure washing, solar panel cleaning, and recurring exterior home care for homeowners in Chico, California.",
        slogan: "Done the right way. When you join, you are family.",
        image: [
          `${PUBLIC_SITE_URL}/atlas-glass/hero-house.jpg`,
          `${PUBLIC_SITE_URL}/day/hour-window.jpg`,
          `${PUBLIC_SITE_URL}/day/hour-pressure.jpg`,
        ],
        areaServed: CHICO_SERVICE_AREA,
        contactPoint: {
          "@type": "ContactPoint",
          telephone: SQUEEGEEKING_PHONE_E164,
          contactType: "customer service",
          areaServed: "US",
          availableLanguage: "English",
        },
        ...(profileUrl ? { sameAs: [profileUrl], hasMap: profileUrl } : {}),
        makesOffer: PUBLIC_SERVICES.map((service) => ({
          "@type": "Offer",
          url: `${PUBLIC_SITE_URL}/services/${service.slug}`,
          itemOffered: {
            "@type": "Service",
            name: service.name,
            serviceType: service.serviceType,
            areaServed: CHICO_SERVICE_AREA,
          },
        })),
      },
      {
        "@type": "WebSite",
        "@id": `${PUBLIC_SITE_URL}/#website`,
        url: PUBLIC_SITE_URL,
        name: CUSTOMER_BRAND.name,
        publisher: { "@id": `${PUBLIC_SITE_URL}/#business` },
        inLanguage: "en-US",
      },
    ],
  };
}

export function buildServiceJsonLd(service: PublicService) {
  const serviceUrl = `${PUBLIC_SITE_URL}/services/${service.slug}`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${serviceUrl}/#service`,
        name: service.name,
        serviceType: service.serviceType,
        description: service.metaDescription,
        url: serviceUrl,
        image: `${PUBLIC_SITE_URL}${service.image}`,
        areaServed: CHICO_SERVICE_AREA,
        provider: { "@id": `${PUBLIC_SITE_URL}/#business` },
        availableChannel: {
          "@type": "ServiceChannel",
          serviceUrl: `${PUBLIC_SITE_URL}/request`,
          servicePhone: {
            "@type": "ContactPoint",
            telephone: SQUEEGEEKING_PHONE_E164,
          },
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: PUBLIC_SITE_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Services",
            item: `${PUBLIC_SITE_URL}/services`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: service.name,
            item: serviceUrl,
          },
        ],
      },
    ],
  };
}

export function buildServicesIndexJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Exterior home care services from ${CUSTOMER_BRAND.name}`,
    itemListElement: PUBLIC_SERVICES.map((service, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: service.name,
      url: `${PUBLIC_SITE_URL}/services/${service.slug}`,
    })),
  };
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export const LOCAL_CONTACT = {
  phoneDisplay: CUSTOMER_CONTACT.phoneDisplay,
  phoneHref: CUSTOMER_CONTACT.phoneHref,
  location: CUSTOMER_BRAND.location,
} as const;
