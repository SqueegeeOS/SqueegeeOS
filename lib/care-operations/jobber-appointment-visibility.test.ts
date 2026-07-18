import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sources = {
  today: readFileSync(
    new URL("../admin/billing-workspace-server.ts", import.meta.url),
    "utf8",
  ),
  portal: readFileSync(
    new URL("../persistence/queries/member-portal.ts", import.meta.url),
    "utf8",
  ),
  memberships: readFileSync(
    new URL("../../app/api/admin/memberships/route.ts", import.meta.url),
    "utf8",
  ),
  commandCenter: readFileSync(
    new URL("../admin/membership-command-center-server.ts", import.meta.url),
    "utf8",
  ),
  customerWorkspace: readFileSync(
    new URL("../hq/customer-workspace/load-workspace.ts", import.meta.url),
    "utf8",
  ),
};

describe("current Jobber appointment visibility", () => {
  it("requires the current approved classification flag on every HQ/portal schedule read", () => {
    for (const source of Object.values(sources)) {
      expect(source).toContain(
        '.eq("jobber_authority_state", AUTHORITATIVE_JOBBER_AUTHORITY_STATE)',
      );
      expect(source).toContain(
        '.not("jobber_visit_classification_id", "is", null)',
      );
    }
  });

  it("binds Today and portal appointments to the exact membership identity", () => {
    expect(sources.today).toContain("jobber_membership_id");
    expect(sources.today).toContain("appointmentByMembership.get(membership.id)");
    expect(sources.portal).toContain(
      '.eq("jobber_membership_id", access.membershipId)',
    );
  });

  it("keeps Jobber pricing and route-completeness claims out of consumers", () => {
    expect(sources.today).not.toContain("jobber_price");
    expect(sources.portal).not.toContain("jobber_price");
    expect(sources.today).not.toContain("routeComplete");
    expect(sources.portal).not.toContain("routeComplete");
  });
});
