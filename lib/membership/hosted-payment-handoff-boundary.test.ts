import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function projectFile(relativePath: string): string {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8")
    .replace(/\r\n/g, "\n");
}

describe("hosted payment handoff boundaries", () => {
  it("keeps link issuance behind HQ authorization", () => {
    const route = projectFile(
      "app/api/admin/memberships/[id]/send-payment-link/route.ts",
    );
    expect(route).toContain("authorizeAdminRequest(request.headers)");
    expect(route.indexOf("authorizeAdminRequest(request.headers)")).toBeLessThan(
      route.lastIndexOf("sendHostedMembershipPaymentLink"),
    );
    expect(route).not.toContain("paymentUrl:");
  });

  it("uses setup-mode Checkout with explicit no-charge language", () => {
    const service = projectFile(
      "lib/membership/hosted-payment-handoff.ts",
    );
    expect(service).toContain('mode: "setup"');
    expect(service).toContain('payment_method_types: ["card"]');
    expect(service).toContain("No charge is collected during this setup step");
    expect(service).not.toContain("amount_total");
    expect(service).not.toContain("line_items");
  });

  it("routes signed Stripe setup completion through the verified reconciler", () => {
    const webhook = projectFile("lib/billing/stripe-billing-webhook.ts");
    expect(webhook).toContain("reconcileHostedMembershipSetupIntent");
    expect(webhook).toContain('setupIntent.metadata?.homeatlas_operation === "membership_hosted_setup"');
  });

  it("reconciles the exact completed Checkout session on the Stripe return path", () => {
    const service = projectFile("lib/membership/hosted-payment-handoff.ts");
    const page = projectFile("app/payment/setup/complete/page.tsx");
    const fallback = projectFile(
      "lib/membership/reconcile-hosted-payment-checkout.ts",
    );

    expect(service).toContain(
      "/payment/setup/complete?session_id={CHECKOUT_SESSION_ID}",
    );
    expect(page).toContain("reconcileHostedMembershipCheckoutSession");
    expect(page).toContain('===\n        "processed"');
    expect(fallback).toContain('session.mode !== "setup"');
    expect(fallback).toContain('session.status !== "complete"');
    expect(fallback).toContain('intent.status !== "succeeded"');
    expect(fallback).toContain("session.client_reference_id !== sessionMetadata.homeatlas_handoff_id");
    expect(fallback).toContain("reconcileHostedMembershipSetupIntent(intent)");
    expect(fallback).not.toContain("paymentIntents.create");
  });

  it("surfaces the email action in the live HQ member cards", () => {
    const page = projectFile("components/admin/hq-memberships-page.tsx");
    expect(page).toContain("PaymentSetupEmailButton");
    expect(page).toContain("!row.cardOnFile");
    expect(page).toContain("membershipId={row.id}");
    expect(page).toContain("canSend={Boolean(row.agreementId)}");
  });

  it("surfaces the same verified handoff in the individual customer workspace", () => {
    const page = projectFile("components/admin/customer-workspace-page.tsx");
    expect(page).toContain("PaymentSetupEmailButton");
    expect(page).toContain('paymentSetupEmailState ===');
    expect(page).toContain('"ready"');
    expect(page).toContain('variant="primary"');
    expect(page).toContain("does not charge it during setup");
  });

  it("offers the same verified action directly in the owner signed-close desk", () => {
    const page = projectFile("components/admin/owner-sales-inbox-page.tsx");
    expect(page).toContain("PaymentSetupEmailButton");
    expect(page).toContain('handoff.stage === "payment_needed"');
    expect(page).toContain('handoff.paymentSetupEmailState === "ready"');
    expect(page).toContain("membershipId={handoff.membershipId}");
    expect(page).toContain("Stripe saves the card; no charge occurs");
  });

  it("offers the same verified action before leaving the signed presentation", () => {
    const onboarding = projectFile(
      "components/presentations/presentation-onboarding.tsx",
    );
    const handoff = projectFile(
      "components/presentations/presentation-payment-email-handoff.tsx",
    );
    const paymentStep = onboarding.indexOf('{step === "payment" ? (');
    const handoffPlacement = onboarding.indexOf(
      "<PresentationPaymentEmailHandoff",
    );
    const completeStep = onboarding.indexOf('{step === "complete" ? (');

    expect(paymentStep).toBeGreaterThan(-1);
    expect(handoffPlacement).toBeGreaterThan(paymentStep);
    expect(handoffPlacement).toBeLessThan(completeStep);
    expect(onboarding).toContain(
      "membershipId={membershipId ?? presentation.membershipId}",
    );
    expect(onboarding).toContain("presentationId={presentation.id}");
    expect(onboarding).toContain("customerEmail={presentation.clientEmail}");
    expect(onboarding).toContain("onReturn={handleDone}");
    expect(handoff).toContain("PaymentSetupEmailButton");
    expect(handoff).toContain("presentationId={presentationId}");
    expect(handoff).toContain("canSend={canSend}");
    expect(handoff).toContain("onAccepted={setAcceptedMessage}");
    expect(handoff).toContain("Nothing sends until you press");
    expect(handoff).toContain("No charge occurs here");
    expect(handoff).not.toContain("fetch(");
  });

  it("authorizes a field send by presentation ownership and derives membership server-side", () => {
    const route = projectFile(
      "app/api/presentations/[id]/send-payment-link/route.ts",
    );
    const button = projectFile(
      "components/admin/payment-setup-email-button.tsx",
    );

    expect(route).toContain(
      "actor = await authorizeSalesPresentationRequest(request.headers, id)",
    );
    expect(
      route.indexOf(
        "actor = await authorizeSalesPresentationRequest(request.headers, id)",
      ),
    ).toBeLessThan(
      route.indexOf("getPresentation(id)"),
    );
    expect(route).toContain('presentation.status !== "signed"');
    expect(route).toContain("membershipId: presentation.membershipId");
    expect(route).toContain("`sales_rep:${actor.repSlug}`");
    expect(route).not.toContain("request.json()");
    expect(button).toContain(
      "`/api/presentations/${encodeURIComponent(presentationId)}/send-payment-link`",
    );
    expect(button).toContain(
      "`/api/admin/memberships/${encodeURIComponent(membershipId)}/send-payment-link`",
    );
    expect(button).toContain("setAccepted(true)");
    expect(button).toContain("sending || accepted");
    expect(button).toContain("Stripe email accepted");
  });

  it("lets the field rep recover a verified close without exposing HQ-only actions", () => {
    const workspace = projectFile(
      "components/sales/sales-rep-workspace.tsx",
    );

    expect(workspace).toContain("PaymentSetupEmailButton");
    expect(workspace).toContain("presentationId={handoff.presentationId}");
    expect(workspace).toContain(
      'handoff.paymentHandoffProgress.canSend',
    );
    expect(workspace).toContain("paymentHandoffSendLabel(");
    expect(workspace).toContain("onAccepted={handlePaymentSetupAccepted}");
    expect(workspace).toContain("Sends only when pressed");
    expect(workspace).toContain("setup step does not charge the customer");
    expect(workspace).toContain("HQ owns next step");
    expect(workspace).toContain("presentationPresentPath(handoff.presentationId");
    expect(workspace).not.toContain("void send()");
  });
});
