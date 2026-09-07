import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const route = read("../../app/api/portal/agreement/route.ts");
const portalLoader = read("../membership/load-member-portal-page.ts");

describe("portal signed agreement access", () => {
  it("does not serialize the expiring storage URL into token portals", () => {
    expect(portalLoader).toContain("portalAgreementAccessPath");
    expect(portalLoader).toContain("/api/portal/agreement?token=");
    expect(portalLoader).toContain("pdfUrl: portalAgreementAccessPath");
  });

  it("authorizes the portal token before looking up a document", () => {
    expect(route).toContain("resolvePortalAccessByToken(token)");
    expect(route).toContain("if (!access) return fail(\"Unauthorized.\", 401)");
  });

  it("opens the exact agreement linked to the membership when available", () => {
    expect(route).toContain("membership.agreement_id");
    expect(route).toContain('.eq("id", membership.agreement_id)');
    expect(route).toContain('.eq("membership_id", access.membershipId)');
    expect(route).toContain('.eq("property_id", access.propertyId)');
    expect(route).toContain('.eq("status", "complete")');
  });

  it("creates a fresh signed storage URL only when View PDF is clicked", () => {
    expect(route).toContain("resolveAgreementPdfAccessUrl(");
    expect(route).toContain("NextResponse.redirect(freshPdfUrl");
    expect(route).toContain('"Cache-Control": "private, no-store, max-age=0"');
  });
});
