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
    expect(membershipsPage).toContain("You only need one future visit booked");
    expect(membershipsPage).toContain("<ScheduleMembershipButton");
  });

  it("separates missing Jobber pairing from a genuinely unbooked visit", () => {
    expect(membershipsPage).toContain('"jobber_property_not_linked"');
    expect(membershipsPage).toContain("Pair in Jobber");
    expect(membershipsPage).toContain("Jobber auto-sync on");
  });

  it("shows current plan-year completion, bookings, and remaining visits", () => {
    expect(membershipsPage).toContain("Current plan year");
    expect(membershipsPage).toContain("visitsCompletedThisYear");
    expect(membershipsPage).toContain("visitsScheduledThisYear");
    expect(membershipsPage).toContain("visitsStillToBook");
    expect(membershipsPage).toContain("upcomingVisits");
  });
});
