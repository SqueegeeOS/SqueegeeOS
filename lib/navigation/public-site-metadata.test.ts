import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PUBLIC_SITE_URL } from "@/lib/brand/urls";

function readProjectFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("public site route policy", () => {
  it("uses the public domain as the stable metadata and sitemap origin", () => {
    expect(PUBLIC_SITE_URL).toBe("https://www.squeegeeking.net");
    expect(readProjectFile("app/layout.tsx")).toContain(
      "metadataBase: new URL(PUBLIC_SITE_URL)",
    );
    expect(readProjectFile("app/sitemap.ts")).toContain("PUBLIC_SITE_URL");
  });

  it("defines canonical URLs for every indexable public page", () => {
    const expectations = [
      ["app/page.tsx", 'canonical: "/"'],
      ["app/request/page.tsx", 'canonical: "/request"'],
      ["app/contact/page.tsx", 'canonical: "/contact"'],
      ["app/services/page.tsx", 'canonical: "/services"'],
    ] as const;
    for (const [path, expected] of expectations) {
      expect(readProjectFile(path)).toContain(expected);
    }

    const servicePage = readProjectFile("app/services/[slug]/page.tsx");
    expect(servicePage).toContain(
      'const canonical = `/services/${service.slug}`',
    );
    expect(servicePage).toContain("generateStaticParams");
  });

  it("keeps alternate visual experiments out of search results and the sitemap", () => {
    for (const path of ["app/day/page.tsx", "app/night/page.tsx"]) {
      expect(readProjectFile(path)).toContain(
        "robots: { index: false, follow: false }",
      );
    }
    const sitemap = readProjectFile("app/sitemap.ts");
    expect(sitemap).not.toContain('url: `${PUBLIC_SITE_URL}/day`');
    expect(sitemap).not.toContain('url: `${PUBLIC_SITE_URL}/night`');
  });

  it("publishes service routes and their source images for discovery", () => {
    const sitemap = readProjectFile("app/sitemap.ts");
    expect(sitemap).toContain('url: `${PUBLIC_SITE_URL}/services`');
    expect(sitemap).toContain(
      'url: `${PUBLIC_SITE_URL}/services/${service.slug}`',
    );
    expect(sitemap).toContain(
      'images: [`${PUBLIC_SITE_URL}${service.image}`]',
    );

    const services = readProjectFile("lib/marketing/public-services.ts");
    for (const slug of [
      "window-cleaning",
      "pressure-washing",
      "solar-panel-cleaning",
      "home-care-memberships",
    ]) {
      expect(services).toContain(`slug: "${slug}"`);
    }
    expect(services).toContain("imageAlt:");
  });

  it("protects private workspaces from caching and search indexing", () => {
    const config = readProjectFile("next.config.ts");
    expect(config).toContain('value: "private, no-store, max-age=0"');
    expect(config).toContain('value: "noindex, nofollow, noarchive"');
    for (const segment of [
      '"/hq"',
      '"/employee"',
      '"/tech"',
      '"/presentations"',
      '"/portal"',
      '"/homecare"',
      '"/properties"',
    ]) {
      expect(readProjectFile("app/robots.ts")).toContain(segment);
    }
  });

  it("provides route-level recovery experiences", () => {
    expect(readProjectFile("app/not-found.tsx")).toContain("Return home");
    expect(readProjectFile("app/error.tsx")).toContain("unstable_retry");
  });

  it("keeps the public request form keyboard and screen-reader legible", () => {
    const requestForm = readProjectFile(
      "components/acquisition/request-form.tsx",
    );
    for (const controlId of [
      "request-name",
      "request-phone",
      "request-email",
      "request-address",
      "request-start-window",
      "request-contact-method",
      "request-notes",
    ]) {
      expect(requestForm).toContain(`htmlFor=\"${controlId}\"`);
      expect(requestForm).toContain(`id=\"${controlId}\"`);
    }
    expect(requestForm).toContain("aria-pressed={selected}");
    expect(requestForm).toContain('role="alert"');
  });
});
