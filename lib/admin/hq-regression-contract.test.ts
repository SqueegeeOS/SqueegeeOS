import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function projectFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("HQ regression recovery contract", () => {
  it("keeps every current founder workspace routable from HQ", () => {
    const requiredRoutes = [
      "app/hq/activation/page.tsx",
      "app/hq/aftercare/page.tsx",
      "app/hq/atlas/page.tsx",
      "app/hq/billing/page.tsx",
      "app/hq/business-pulse/page.tsx",
      "app/hq/communications/page.tsx",
      "app/hq/enrollment/page.tsx",
      "app/hq/growth/page.tsx",
      "app/hq/jobber/page.tsx",
      "app/hq/memberships/page.tsx",
      "app/hq/requests/page.tsx",
      "app/hq/sales/page.tsx",
      "app/hq/technicians/page.tsx",
      "app/hq/today/page.tsx",
    ];

    for (const route of requiredRoutes) {
      expect(() => projectFile(route), route).not.toThrow();
    }

    const founderNav = projectFile("components/admin/hq-founder-nav.tsx");
    for (const label of [
      "Today",
      "Atlas",
      "Pulse",
      "Requests",
      "Sales",
      "Enroll",
      "Inbox",
      "Members",
      "Jobber",
      "Team",
      "Care",
      "Billing",
      "Numbers",
      "Growth",
      "Health",
      "Overview",
    ]) {
      expect(founderNav).toContain(`label: "${label}"`);
    }
  });

  it("keeps the source-backed Numbers metrics and Jobber next-service path", () => {
    const numbers = projectFile("components/admin/business-pulse-page.tsx");
    expect(numbers).toContain("Qualified membership ARR");
    expect(numbers).toContain("Qualified membership MRR");
    expect(numbers).toContain("Revenue + qualified ARR momentum");

    const membershipApi = projectFile("app/api/admin/memberships/route.ts");
    expect(membershipApi).toContain("selectPairedJobberNextVisit");
    expect(membershipApi).toContain('source: "paired_jobber_projection"');
    expect(membershipApi).toContain("pairedJobberVisit?.scheduled_start");

    const membershipUi = projectFile("components/admin/hq-memberships-page.tsx");
    expect(membershipUi).toContain("live Jobber link");
    expect(membershipUi).toContain("No upcoming visit is booked yet");
  });
});
