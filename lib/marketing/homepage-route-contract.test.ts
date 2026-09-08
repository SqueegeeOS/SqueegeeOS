import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  NOAH_PERSONAL_NOTE,
  SQUEEGEEKING_FOUNDERS,
  SQUEEGEEKING_TEAM_LEADS,
  foundersAsPlanTeam,
} from "../team/founders";

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
      'import heroHouse from "@/public/atlas-glass/hero-house-wide.png"',
    );
    expect(readProjectFile("app/page.tsx")).toContain(
      "/atlas-glass/hero-house-wide.png",
    );
    expect(readProjectFile("app/sitemap.ts")).toContain(
      "/atlas-glass/hero-house-wide.png",
    );
  });

  it("keeps the promoted homepage personal and tied to the real founding team", () => {
    const atlas = readProjectFile("app/atlas-glass/atlas-glass.tsx");
    const leadership = readProjectFile("app/atlas-glass/atlas-leadership.tsx");

    expect(atlas).toContain('import { AtlasLeadership } from "./atlas-leadership"');
    expect(atlas).toContain("<AtlasLeadership />");
    expect(atlas).toContain('id="founders"');
    expect(leadership).toContain('from "@/lib/team/founders"');
    expect(leadership).toContain("SQUEEGEEKING_FOUNDERS.map");
    expect(leadership).toContain("SQUEEGEEKING_TEAM_LEADS.map");
    expect(atlas).toContain("MEMBER_ORBIT_FEATURES");
    expect(atlas).toContain("RainBlock treatment");
    expect(atlas).toContain("Built in Chico.");
    expect(atlas).toContain("Kept human.");
    expect(atlas).not.toContain("The Bennett Home");
  });

  it("uses the approved executive and team-lead identities without changing the founder API", () => {
    expect(SQUEEGEEKING_FOUNDERS.map(({ name, role }) => ({ name, role }))).toEqual([
      { name: "Noah Thomas", role: "Founder & CEO" },
      { name: "Dasan Gramps", role: "Chief Operating Officer" },
    ]);
    expect(SQUEEGEEKING_TEAM_LEADS.map(({ name, role }) => ({ name, role }))).toEqual([
      { name: "David", role: "Head of Sales" },
      { name: "Tyler", role: "Lead Technician" },
    ]);
    expect(NOAH_PERSONAL_NOTE.title).toBe("Founder & CEO");
    expect(foundersAsPlanTeam().map(({ id }) => id)).toEqual(
      SQUEEGEEKING_FOUNDERS.map(({ id }) => id),
    );
    const people = [...SQUEEGEEKING_FOUNDERS, ...SQUEEGEEKING_TEAM_LEADS];
    expect(new Set(people.map(({ id }) => id)).size).toBe(4);
    for (const member of SQUEEGEEKING_TEAM_LEADS) {
      expect(member.portraitPlaceholder).toBe("team");
      expect(member.quote).toBeUndefined();
    }
  });

  it("keeps team leads in a separate compact group across the homepage and care plans", () => {
    const leadership = readProjectFile("app/atlas-glass/atlas-leadership.tsx");
    const sharedTeam = readProjectFile("components/team/meet-the-founders.tsx");
    const carePlanTeam = readProjectFile("components/home-care-plan/sections/meet-your-team.tsx");
    const teamCss = readProjectFile("app/atlas-glass/atlas-team.module.css");

    for (const source of [leadership, sharedTeam]) {
      expect(source).toContain('aria-label="Company leadership"');
      expect(source).toContain('aria-label="Team leads"');
      expect(source).toContain("SQUEEGEEKING_TEAM_LEADS");
      expect(source).toContain("compact");
      expect(source.indexOf('aria-label="Company leadership"')).toBeLessThan(
        source.indexOf('aria-label="Team leads"'),
      );
    }
    expect(sharedTeam).toContain("teamLeads = SQUEEGEEKING_TEAM_LEADS");
    expect(carePlanTeam).toContain("<MeetTheFounders");
    expect(teamCss).toContain("width: 88%");
    expect(teamCss).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(teamCss).toContain(".hierarchy .leadCard");
  });
});
