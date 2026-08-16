import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const page = read("../../app/hq/jobber/page.tsx");
const route = read(
  "../../app/api/admin/care-operations/jobber/property-links/route.ts",
);
const service = read("./jobber-property-matching.ts");
const panel = read("../../components/admin/jobber-visit-workspace-panel.tsx");
const connection = read("../../components/admin/jobber-connection-panel.tsx");
const handoff = read("../sales/production-handoff.ts");

describe("signed member to Jobber continuity", () => {
  it("carries only validated opaque focus through the private HQ page", () => {
    expect(page).toContain("await searchParams");
    expect(page).toContain("resolveJobberHandoffFocus");
    expect(handoff).toContain(
      'jobberHandoffHref(membership.id, "property")',
    );
    expect(handoff).toContain('jobberHandoffHref(membership.id, "job")');
    expect(handoff).not.toContain("homeownerName=");
    expect(handoff).not.toContain("propertyAddress=");
    expect(connection).toContain('getElementById("jobber-visits")');
  });

  it("propagates the focused membership through every read-after-write", () => {
    expect(panel).toContain('params.set("membershipId", focusMembershipId)');
    expect(panel).toContain("focusMembershipId,");
    expect(route).toContain(
      'focusMembershipId: url.searchParams.get("membershipId")',
    );
    expect(route).toContain("focusMembershipId: body.focusMembershipId");
  });

  it("narrows the candidate list to the exact active membership", () => {
    expect(service).toContain("loadFocusedMemberProperty(focusMembershipId)");
    expect(service).toContain("data: [focusedMember.membership]");
    expect(service).toContain("focusedMemberProperty:");
    expect(panel).toContain(
      "workspace?.focusedMemberProperty?.membershipId",
    );
    expect(panel).toContain("Finish {workspace.focusedMemberProperty.homeownerName}");
  });

  it("prefers confirmed Jobber identity over a fragile name search", () => {
    expect(service).toContain('.from("jobber_property_links")');
    expect(service).toContain('.from("jobber_customer_links")');
    expect(service).toContain("exactExternalPropertyId");
    expect(service).toContain("exactExternalClientId");
    expect(service).toContain("externalPropertyId: exactExternalPropertyId");
    expect(service).toContain("externalClientId: exactExternalClientId");
    expect(service).toContain("focusedMember?.candidate.homeownerName");
  });

  it("retains supervised confirmation and never writes on navigation", () => {
    expect(panel).toContain("samePhysicalPropertyConfirmed");
    expect(panel).toContain("membershipServiceConfirmed");
    expect(panel).toContain("locked the dropdown");
    expect(panel).toContain("Return to handoff");
    expect(panel).toContain("focusedJobReady");
    expect(service).not.toMatch(/paymentIntents\.create|paymentIntents\.confirm/);
  });
});
