import type { MetadataRoute } from "next";
import { PUBLIC_SITE_URL } from "@/lib/brand/urls";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/hq",
          "/admin",
          "/api",
          "/portal",
          "/presentations",
          "/employee",
          "/tech",
          "/homecare",
          "/properties",
          "/setup",
          "/experience",
          "/rightway-lab",
        ],
      },
    ],
    sitemap: `${PUBLIC_SITE_URL}/sitemap.xml`,
  };
}
