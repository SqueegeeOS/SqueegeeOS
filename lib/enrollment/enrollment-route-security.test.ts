import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const sendRoute = read("../../app/api/admin/enrollment-packets/route.ts");
const preflightRoute = read(
  "../../app/api/admin/enrollment/preflight/route.ts",
);
const preflight = read("./preflight.ts");
const readinessRoute = read("../../app/api/admin/enrollment/readiness/route.ts");
const docusignProbeRoute = read(
  "../../app/api/admin/enrollment/docusign/probe/route.ts",
);
const connectRoute = read("../../app/api/integrations/docusign/connect/route.ts");
const stripeHandoff = read("./stripe-handoff.ts");
const docusignProcessor = read("./process-docusign-connect.ts");
const sendPacket = read("./send-packet.ts");
const legalReleaseRoute = read(
  "../../app/api/admin/enrollment/legal-release/route.ts",
);

describe("enrollment route security contract", () => {
  it("keeps packet creation behind presentation ownership and readiness behind HQ auth", () => {
    expect(sendRoute).toContain(
      "authorizeSalesPresentationRequest(request.headers, presentationId)",
    );
    expect(readinessRoute).toContain("authorizeAdminRequest(request.headers)");
    expect(sendRoute).toContain("export async function GET(request: Request)");
    expect(sendRoute).toContain("loadEnrollmentPacketStatus(presentationId)");
    expect(
      readinessRoute.indexOf("authorizeAdminRequest(request.headers)"),
    ).toBeLessThan(
      readinessRoute.indexOf("getEnrollmentLegalReviewPacket()"),
    );
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

  it("keeps no-send rehearsal behind presentation ownership and free of side effects", () => {
    expect(preflightRoute).toContain(
      "authorizeSalesPresentationRequest(request.headers, presentationId)",
    );
    expect(preflightRoute.indexOf("authorizeSalesPresentationRequest")).toBeLessThan(
      preflightRoute.indexOf("getPresentation(presentationId)"),
    );
    expect(preflightRoute).toContain("buildEnrollmentPreflightReport");
    expect(preflight).toContain('mode: "no_side_effects"');
    expect(`${preflightRoute}\n${preflight}`).not.toMatch(
      /sendEnrollmentPacket|createDocuSignEnrollmentEnvelope|sendCreatedDocuSignEnvelope|createEnrollmentStripeHandoff|createServiceRoleSupabaseClient/,
    );
    expect(preflightRoute).not.toMatch(
      /\.(insert|update|delete)\(/,
    );
  });

  it("blocks the wrong rehearsal recipient before any packet read or write", () => {
    const sendStart = sendPacket.indexOf("export async function sendEnrollmentPacket");
    const recipientGate = sendPacket.indexOf(
      "getEnrollmentRecipientGate(email)",
      sendStart,
    );
    const packetClient = sendPacket.indexOf(
      "const supabase = createServiceRoleSupabaseClient()",
      sendStart,
    );

    expect(recipientGate).toBeGreaterThan(sendStart);
    expect(packetClient).toBeGreaterThan(recipientGate);
  });

  it("keeps owner release behind HQ auth and re-verifies provider bytes without sending", () => {
    const auth = legalReleaseRoute.indexOf("authorizeAdminRequest(request.headers)");
    const probe = legalReleaseRoute.indexOf("probeDocuSignEnrollmentTemplate()", auth);
    const release = legalReleaseRoute.indexOf(
      'supabase.rpc("release_enrollment_agreement_pair"',
      probe,
    );

    expect(auth).toBeGreaterThan(-1);
    expect(probe).toBeGreaterThan(auth);
    expect(release).toBeGreaterThan(probe);
    expect(legalReleaseRoute).not.toMatch(
      /createDocuSignEnrollmentEnvelope|sendCreatedDocuSignEnvelope|createEnrollmentStripeHandoff/,
    );
  });

  it("parses preflight and send requests through the same contract", () => {
    expect(sendRoute).toContain("parseEnrollmentSubmission(body)");
    expect(preflightRoute).toContain("parseEnrollmentSubmission(body)");
  });

  it("keeps the read-only DocuSign probe behind HQ auth and away from envelope writes", () => {
    expect(docusignProbeRoute).toContain("authorizeAdminRequest(request.headers)");
    expect(docusignProbeRoute).toContain("probeDocuSignEnrollmentTemplate");
    expect(
      docusignProbeRoute.indexOf("authorizeAdminRequest(request.headers)"),
    ).toBeLessThan(
      docusignProbeRoute.lastIndexOf("probeDocuSignEnrollmentTemplate()"),
    );
    expect(docusignProbeRoute).not.toMatch(
      /createDocuSignEnrollmentEnvelope|sendCreatedDocuSignEnvelope|createEnrollmentStripeHandoff/,
    );
  });

  it("keeps cash/check owner-only and structurally outside every Stripe handoff", () => {
    expect(sendRoute).toContain(
      'parsed.value.paymentRail === "manual_cash_check"',
    );
    expect(sendRoute).toContain('actor.kind !== "admin"');
    expect(docusignProcessor).toContain(
      'packet.payment_rail === "manual_cash_check"',
    );
    expect(docusignProcessor).toContain("completeManualPaymentHandoff");
    expect(
      docusignProcessor.indexOf('packet.payment_rail === "manual_cash_check"'),
    ).toBeLessThan(docusignProcessor.lastIndexOf("createEnrollmentStripeHandoff"));
    expect(stripeHandoff).toContain(
      'input.packet.payment_rail !== "stripe_card"',
    );
  });
});
