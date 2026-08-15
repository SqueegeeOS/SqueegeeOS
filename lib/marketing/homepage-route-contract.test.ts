import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function projectUrl(path: string): URL {
  return new URL(`../../${path}`, import.meta.url);
}

function readProjectFile(path: string): string {
  return readFileSync(projectUrl(path), "utf8");
}

describe("public homepage route contract", () => {
  it("promotes Atlas Glass while preserving the prior homepage at /rightway", () => {
    const homepage = readProjectFile("app/page.tsx");
    const rightway = readProjectFile("app/rightway/page.tsx");
    const atlasAlias = readProjectFile("app/atlas-glass/page.tsx");

    expect(homepage).toContain('import { AtlasGlass }');
    expect(homepage).toContain("<AtlasGlass />");
    expect(homepage).toContain("buildLocalBusinessJsonLd");
    expect(rightway).toContain('import { Day2Homepage }');
    expect(rightway).toContain("<Day2Homepage />");
    expect(rightway).not.toContain("permanentRedirect");
    expect(rightway).toContain("robots: { index: false, follow: false }");
    expect(atlasAlias).toContain('alternates: { canonical: "/" }');
    expect(atlasAlias).toContain("robots: { index: false, follow: false }");
  });

  it("keeps every Atlas homepage destination backed by a real public page", () => {
    const atlas = readProjectFile("app/atlas-glass/atlas-glass.tsx");
    const staticRoutes = [
      "/request",
      "/services",
      "/contact",
      "/privacy",
      "/terms",
    ];
    const serviceSlugs = [
      "window-cleaning",
      "pressure-washing",
      "solar-panel-cleaning",
      "home-care-memberships",
    ];

    for (const route of staticRoutes) {
      expect(atlas).toContain(`"${route}"`);
      expect(existsSync(projectUrl(`app${route}/page.tsx`))).toBe(true);
    }

    expect(existsSync(projectUrl("app/services/[slug]/page.tsx"))).toBe(true);
    const publicServices = readProjectFile("lib/marketing/public-services.ts");
    for (const slug of serviceSlugs) {
      expect(atlas).toContain(`"/services/${slug}"`);
      expect(publicServices).toContain(`slug: "${slug}"`);
    }
  });

  it("uses one deliberate navigation system on each comparison homepage", () => {
    const navigation = readProjectFile("lib/navigation/resolve.ts");

    expect(navigation).toContain("pathname === ROUTES.home");
    expect(navigation).toContain('"/atlas-glass"');
    expect(navigation).toContain('pathname === "/rightway"');
  });

  it("uses the promoted hero in search and sharing metadata", () => {
    expect(readProjectFile("app/atlas-glass/atlas-glass.tsx")).toContain(
      'import heroHouse from "@/public/atlas-glass/hero-house.jpg"',
    );
    expect(readProjectFile("app/page.tsx")).toContain(
      "/atlas-glass/hero-house.jpg",
    );
    expect(readProjectFile("app/sitemap.ts")).toContain(
      "/atlas-glass/hero-house.jpg",
    );
  });

  it("keeps the promoted homepage personal and tied to the real founding team", () => {
    const atlas = readProjectFile("app/atlas-glass/atlas-glass.tsx");

    expect(atlas).toContain("SQUEEGEEKING_FOUNDERS");
    expect(atlas).toContain("MEMBER_ORBIT_FEATURES");
    expect(atlas).toContain("RainBlock treatment");
    expect(atlas).toContain("Built in Chico.");
    expect(atlas).toContain("Kept human.");
    expect(atlas).not.toContain("The Bennett Home");
  });
});
