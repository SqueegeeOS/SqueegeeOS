import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const membershipsPage = readFileSync(
  new URL("../../components/admin/hq-memberships-page.tsx", import.meta.url),
  "utf8",
);

describe("existing member scheduling reminder", () => {
  it("puts members needing scheduling first and provides the existing safe scheduler", () => {
    expect(membershipsPage).toContain('"needs scheduling": 0');
    expect(membershipsPage).toContain("Scheduling reminder");
    expect(membershipsPage).toContain("matched, verified Jobber visit");
    expect(membershipsPage).toContain("<ScheduleMembershipButton");
  });

  it("explains that the queue follows the automatic Jobber refresh", () => {
    expect(membershipsPage).toContain("daily Jobber sync");
    expect(membershipsPage).toContain("Jobber auto-sync on");
  });
});
