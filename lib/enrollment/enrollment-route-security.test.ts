import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const sendRoute = read("../../app/api/admin/enrollment-packets/route.ts");
const readinessRoute = read("../../app/api/admin/enrollment/readiness/route.ts");
const connectRoute = read("../../app/api/integrations/docusign/connect/route.ts");
const stripeHandoff = read("./stripe-handoff.ts");
const docusignProcessor = read("./process-docusign-connect.ts");

describe("enrollment route security contract", () => {
  it("keeps packet creation behind presentation ownership and readiness behind HQ auth", () => {
    expect(sendRoute).toContain(
      "authorizeSalesPresentationRequest(request.headers, presentationId)",
    );
    expect(readinessRoute).toContain("authorizeAdminRequest(request.headers)");
  });

  it("verifies DocuSign against the untouched body before processing", () => {
    const rawBodyIndex = connectRoute.indexOf("await request.text()");
    const hmacIndex = connectRoute.indexOf(
      "verifyDocuSignConnectHmac",
      rawBodyIndex,
    );
    const processIndex = connectRoute.indexOf(
      "processDocuSignEnrollmentConnect",
      hmacIndex,
    );

    expect(rawBodyIndex).toBeGreaterThan(-1);
    expect(hmacIndex).toBeGreaterThan(rawBodyIndex);
    expect(processIndex).toBeGreaterThan(hmacIndex);
    expect(connectRoute).toContain("x-docusign-signature-");
    expect(connectRoute).not.toContain("await request.json()");
  });

  it("creates Stripe setup mode only after completed signature processing", () => {
    expect(stripeHandoff).toContain('mode: "setup"');
    expect(stripeHandoff).toContain('payment_method_types: ["card"]');
    expect(stripeHandoff).toContain("No payment is collected today");
    expect(docusignProcessor).toContain('normalizedStatus !== "completed"');
    expect(docusignProcessor).toContain("completeRemoteEnrollmentSignature");
    expect(docusignProcessor).toContain("createEnrollmentStripeHandoff");
    expect(
      docusignProcessor.indexOf("completeRemoteEnrollmentSignature"),
    ).toBeLessThan(docusignProcessor.indexOf("createEnrollmentStripeHandoff"));
  });
});
