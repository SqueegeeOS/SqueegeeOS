import type { MetadataRoute } from "next";
import { PUBLIC_SITE_URL } from "@/lib/brand/urls";
import { PUBLIC_SERVICES } from "@/lib/marketing/public-services";
import { HOMEOWNER_GUIDES } from "@/lib/marketing/homeowner-guides";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${PUBLIC_SITE_URL}/`,
      changeFrequency: "weekly",
      priority: 1,
      images: [`${PUBLIC_SITE_URL}/atlas-glass/hero-house-wide.png`],
    },
    {
      url: `${PUBLIC_SITE_URL}/services`,
      changeFrequency: "monthly",
      priority: 0.9,
      images: PUBLIC_SERVICES.map(
        (service) => `${PUBLIC_SITE_URL}${service.image}`,
      ),
    },
    ...PUBLIC_SERVICES.map((service) => ({
      url: `${PUBLIC_SITE_URL}/services/${service.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.85,
      images: [`${PUBLIC_SITE_URL}${service.image}`],
    })),
    { url: `${PUBLIC_SITE_URL}/request`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${PUBLIC_SITE_URL}/contact`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${PUBLIC_SITE_URL}/guides`, changeFrequency: "monthly", priority: 0.7 },
    ...HOMEOWNER_GUIDES.map((guide) => ({ url: `${PUBLIC_SITE_URL}/guides/${guide.slug}`, changeFrequency: "monthly" as const, priority: 0.65 })),
  ];
}
