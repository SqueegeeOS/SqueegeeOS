import type { MetadataRoute } from "next";

const BASE = "https://www.squeegeeking.net";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/request`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/day`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE}/night`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];
}
