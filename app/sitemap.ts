import type { MetadataRoute } from "next";
import { PUBLIC_SITE_URL } from "@/lib/brand/urls";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${PUBLIC_SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${PUBLIC_SITE_URL}/request`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${PUBLIC_SITE_URL}/contact`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${PUBLIC_SITE_URL}/day`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${PUBLIC_SITE_URL}/night`, changeFrequency: "monthly", priority: 0.4 },
  ];
}
