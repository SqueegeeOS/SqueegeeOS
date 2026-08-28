import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const route = read(
  "../../app/api/enrollment/[token]/native-signature/route.ts",
);
const sendPacket = read("./send-packet.ts");
const handoff = read("../../components/enrollment/enrollment-handoff-page.tsx");
const completion = read("./complete-remote-signature.ts");
const repair = read("./repair-recorded-native-enrollment.ts");

describe("HomeAtlas native enrollment signature contract", () => {
  it("keeps the customer signature behind the private packet token and provider binding", () => {
    expect(route).toContain("isPlausibleEnrollmentToken(token)");
    expect(route).toContain("enrollmentTokenSha256(token)");
    expect(route).toContain('packet.signature_provider !== "homeatlas_native"');
    expect(route).toContain('packet.status !== "signature_sent"');
    expect(route).toContain('body?.consent !== true');
    expect(route).toContain("MAX_SIGNATURE_DATA_URL_LENGTH");
    expect(route).not.toContain("body.signedAt");
  });

  it("stores signature evidence before advancing payment or portal state", () => {
    const complete = route.indexOf("completeRemoteEnrollmentSignature");
    const save = route.indexOf('status: "signature_complete"');
    const manual = route.lastIndexOf("completeManualPaymentHandoff");
    const stripe = route.lastIndexOf("createEnrollmentStripeHandoff");

    expect(complete).toBeGreaterThan(-1);
    expect(save).toBeGreaterThan(complete);
    expect(manual).toBeGreaterThan(save);
    expect(stripe).toBeGreaterThan(save);
  });

  it("does not create or send a DocuSign envelope for native packets", () => {
    expect(sendPacket).toContain(
      'input.signatureProvider === "docusign" && !envelopeId',
    );
    expect(sendPacket).toContain(
      'input.signatureProvider === "docusign" &&',
    );
  });

  it("uses the luxury forest and ivory treatment without mustard gradients", () => {
    expect(handoff).toContain("bg-[#08100c]");
    expect(handoff).toContain("bg-[#f4efe6]");
    expect(handoff).toContain("Sign and accept");
    expect(handoff).not.toContain("#ead8ad");
    expect(handoff).not.toContain("#f0c85b");
  });

  it("shows the visit-by-visit agreement details immediately", () => {
    expect(handoff).toMatch(/<details\s+open\s+className=/);
  });

  it("keeps manual-payment membership pause metadata consistent", () => {
    expect(completion).toContain("enrollmentMembershipBillingState({");
    expect(completion).toContain("manualPayment,");
    expect(completion).toContain(
      "pausedAt: packet.manual_payment_approved_at ?? input.signedAt",
    );
  });

  it("repairs a recorded signature only after matching its saved evidence", () => {
    const evidence = repair.indexOf('external_signature_provider", "homeatlas_native"');
    const membership = repair.indexOf('from("memberships")');
    const packet = repair.indexOf('status: "signature_complete"');
    const portal = repair.lastIndexOf("completeManualPaymentHandoff");

    expect(evidence).toBeGreaterThan(-1);
    expect(membership).toBeGreaterThan(evidence);
    expect(packet).toBeGreaterThan(membership);
    expect(portal).toBeGreaterThan(packet);
  });
});
