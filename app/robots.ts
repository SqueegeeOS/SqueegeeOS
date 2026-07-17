import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/hq/", "/admin/", "/api/", "/portal/", "/presentations/", "/employee/", "/tech/"],
      },
    ],
    sitemap: "https://www.squeegeeking.net/sitemap.xml",
  };
}
