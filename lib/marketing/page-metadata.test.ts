import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { metadata as paymentMetadata } from "@/app/payment/layout";
import nextConfig from "@/next.config";
import { PUBLIC_SITE_URL } from "@/lib/brand/urls";
import { PUBLIC_SERVICES } from "./public-services";
import { buildPublicPageMetadata } from "./page-metadata";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("public search and social metadata", () => {
  it.each(PUBLIC_SERVICES)("keeps $slug search, Open Graph and Twitter specific to the service", (service) => {
    const path = `/services/${service.slug}`;
    const result = buildPublicPageMetadata({
      title: service.pageTitle,
      description: service.metaDescription,
      path,
      image: { url: service.image, width: 1376, height: 768, alt: service.imageAlt },
    });
    const title = `${service.pageTitle} | SqueegeeKing`;
    expect(result.title).toEqual({ absolute: title });
    expect(result.description).toBe(service.metaDescription);
    expect(result.alternates).toEqual({ canonical: path });
    expect(result.openGraph).toMatchObject({
      title, description: service.metaDescription, url: path,
      siteName: "SqueegeeKing", locale: "en_US",
      images: [{ url: service.image, alt: service.imageAlt }],
    });
    expect(result.twitter).toMatchObject({
      title, description: service.metaDescription,
      images: [{ url: service.image, alt: service.imageAlt }],
    });
  });

  it("uses the shared metadata contract on every indexable public route", () => {
    for (const path of ["app/page.tsx", "app/services/page.tsx", "app/services/[slug]/page.tsx", "app/request/page.tsx", "app/contact/page.tsx", "app/privacy/page.tsx", "app/terms/page.tsx"]) {
      expect(read(path)).toContain("buildPublicPageMetadata({");
    }
    expect(read("app/services/page.tsx")).toContain('title: "Exterior Cleaning Services in Chico, CA"');
    expect(read("app/privacy/page.tsx")).toContain('path: "/privacy"');
    expect(read("app/terms/page.tsx")).toContain('path: "/terms"');
  });

  it("provides a descriptive image with alt text when a public route has no own image", () => {
    const result = buildPublicPageMetadata({ title: "Contact", description: "Contact SqueegeeKing in Chico.", path: "/contact" });
    expect(result.openGraph).toMatchObject({ url: "/contact", images: [{ url: "/atlas-glass/hero-house-wide.png" }] });
    expect(result.twitter).toMatchObject({ title: "Contact | SqueegeeKing", card: "summary_large_image", images: [{ alt: expect.any(String) }] });
  });

  it("lists only canonical public landing pages, with crawlable local images", () => {
    const entries = sitemap();
    const expected = ["/", "/services", ...PUBLIC_SERVICES.map((service) => `/services/${service.slug}`), "/request", "/contact"];
    expect(entries.map((entry) => entry.url).sort()).toEqual(expected.map((path) => `${PUBLIC_SITE_URL}${path}`).sort());
    expect(new Set(entries.map((entry) => entry.url)).size).toBe(entries.length);
    const rules = robots().rules;
    const allRules = Array.isArray(rules) ? rules : [rules];
    for (const entry of entries) {
      const path = new URL(entry.url).pathname;
      for (const rule of allRules) {
        const blocked = typeof rule.disallow === "string" ? [rule.disallow] : rule.disallow ?? [];
        expect(blocked.some((prefix) => path.startsWith(prefix))).toBe(false);
      }
      for (const image of entry.images ?? []) {
        expect(existsSync(new URL(`../../public${new URL(image).pathname}`, import.meta.url))).toBe(true);
      }
    }
  });

  it("keeps quote purpose and a working phone option in the server-rendered fallback", () => {
    const source = read("components/acquisition/request-form.tsx");
    const fallback = source.slice(source.indexOf("function RequestFormFallback()"));
    expect(fallback).toContain("<main");
    expect(fallback).toContain("<h1");
    expect(fallback).toContain("Request a free quote");
    expect(fallback).toContain("CUSTOMER_CONTACT.phoneHref");
    expect(fallback).toContain("<noscript>");
    expect(source).toContain('<main className="relative min-h-screen');
  });

  it("keeps every payment return route out of search without changing payment behavior", async () => {
    expect(paymentMetadata.robots).toMatchObject({ index: false, follow: false, googleBot: { index: false, follow: false } });
    const headers = await nextConfig.headers!();
    const payment = headers.find((entry) => entry.source === "/payment/:path*");
    expect(payment?.headers).toContainEqual({ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" });
    expect(payment?.headers).toContainEqual({ key: "Cache-Control", value: "private, no-store, max-age=0" });
    expect(headers.some((entry) => entry.source.startsWith("/services") && entry.headers.some((header) => header.key === "X-Robots-Tag"))).toBe(false);
  });
});
