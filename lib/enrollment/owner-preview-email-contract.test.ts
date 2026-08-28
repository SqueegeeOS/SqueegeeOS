import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL(
    "../../app/api/admin/enrollment/owner-preview-email/route.ts",
    import.meta.url,
  ),
  "utf8",
);

describe("owner enrollment preview email boundary", () => {
  it("is admin-only and locked to the configured rehearsal recipient", () => {
    expect(source).toContain("authorizeAdminRequest(request.headers)");
    expect(source).toContain("HOMEATLAS_ENROLLMENT_REHEARSAL_EMAIL");
    expect(source).toContain("getEnrollmentRecipientGate(recipient)");
    expect(source).not.toContain("request.json()");
  });

  it("uses only the harmless owner preview link and native signing email", () => {
    expect(source).toContain("HOMEATLAS_ENROLLMENT_PREVIEW_TOKEN");
    expect(source).toContain("/enroll/preview/");
    expect(source).toContain('signatureProvider: "homeatlas_native"');
    expect(source).toContain("buildSignatureInvitationEmail");
  });
});
