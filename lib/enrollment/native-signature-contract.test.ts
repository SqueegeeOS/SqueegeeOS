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
const agreementView = read("../../app/api/enrollment/[token]/agreement/route.ts");
const stripeHandoff = read("./stripe-handoff.ts");
const manualHandoff = read("./manual-payment-handoff.ts");
const reminderConsent = read("./visit-reminder-consent.ts");
const reminderConsentMigration = read(
  "../persistence/supabase/migrations/20260929180000_signed_enrollment_visit_sms_consent.sql",
);
const vercelConfig = JSON.parse(read("../../vercel.json")) as {
  crons: { path: string; schedule: string }[];
};

describe("HomeAtlas native enrollment signature contract", () => {
  it("keeps the customer signature behind the private packet token and provider binding", () => {
    expect(route).toContain("isPlausibleEnrollmentToken(token)");
    expect(route).toContain("findEnrollmentPacketByToken(token)");
    expect(route).toContain('packet.signature_provider !== "homeatlas_native"');
    expect(route).toContain('packet.status !== "signature_sent"');
    expect(route).toContain('body?.consent !== true');
    expect(route).toContain("MAX_SIGNATURE_DATA_URL_LENGTH");
    expect(route).not.toContain("body.signedAt");
  });

  it("keeps visit texts optional and records exact-number consent only after signing", () => {
    expect(handoff).toContain("smsReminderOptIn");
    expect(handoff).toContain("This is optional and not required to join");
    expect(handoff).toContain("Reply STOP to opt out or HELP for help");
    expect(route).toContain("optedIn: body.smsReminderOptIn === true");
    expect(route.indexOf('status: "signature_complete"')).toBeLessThan(
      route.lastIndexOf("recordEnrollmentVisitReminderConsent({"),
    );
    expect(reminderConsent).toContain("normalizeNorthAmericanPhone");
    expect(reminderConsentMigration).toContain("packet.signed_at");
    expect(reminderConsentMigration).toContain("v_prior_status = 'opted_out'");
    expect(reminderConsentMigration).toContain("'customer_signed_enrollment_opt_in'");
    expect(reminderConsentMigration).toContain("from public, anon, authenticated");
    expect(vercelConfig.crons).toContainEqual({
      path: "/api/cron/communications",
      schedule: "35 17 * * *",
    });
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

  it("hands a completed signer directly to the hosted Stripe setup page", () => {
    expect(route).toContain("paymentUrl: handoff.paymentUrl");
    expect(handoff).toContain("openStripeCheckout(result?.paymentUrl)");
    expect(handoff).toContain('url.hostname !== "checkout.stripe.com"');
    expect(handoff).toContain("window.location.assign(url.href)");
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

  it("leads with the per-visit price and keeps annual details available on request", () => {
    expect(handoff).toContain("money(status.recurringVisitPriceCents)");
    expect(handoff).toContain("per planned visit");
    expect(handoff).toContain("View annual plan details");
    expect(handoff).toContain("money(agreement.annualTotalCents)");
    expect(handoff).not.toMatch(/<details\s+open\s+className=/);
  });

  it("offers the exact private PDF before signing and the saved PDF afterward", () => {
    expect(handoff).toContain("View agreement PDF");
    expect(handoff).toContain("View your signed agreement (PDF)");
    expect(agreementView).toContain("findEnrollmentPacketByToken(token)");
    expect(agreementView).toContain('packet.signature_provider !== "homeatlas_native"');
    expect(agreementView).toContain("generateEnrollmentAgreementPreviewPDF");
    expect(agreementView).toContain('.eq("id", packet.signed_agreement_id)');
    expect(agreementView).toContain('"Cache-Control": "private, no-store, max-age=0"');
  });

  it("attaches the vault PDF to both native post-sign email rails", () => {
    expect(stripeHandoff).toContain("loadEnrollmentSignedPdfAttachment");
    expect(stripeHandoff).toContain("attachments: [signedPdf]");
    expect(manualHandoff).toContain("loadEnrollmentSignedPdfAttachment");
    expect(manualHandoff).toContain("attachments: [signedPdf]");
  });

  it("persists the signed plan through the current presentation draft schema", () => {
    expect(completion).toContain(
      "draft_payload: createPresentationDraftPayload(signedPresentation)",
    );
    expect(completion).not.toContain('plan_mode: "custom"');
    expect(completion).not.toContain("care_plan: signedPresentation.carePlan");
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
