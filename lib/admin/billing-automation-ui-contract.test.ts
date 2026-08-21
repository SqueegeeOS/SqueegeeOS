import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("HQ automatic-billing UI safety contract", () => {
  it("keeps the billing rehearsal explicit, useful, and non-charging", () => {
    const panel = read("../../components/admin/billing-automation-panel.tsx");

    expect(panel).toContain('body: JSON.stringify({ action: "preview" })');
    expect(panel).toContain("Run billing rehearsal (no charge)");
    expect(panel).toContain("Stripe not contacted");
    expect(panel).toContain("eligibleAmountCents");
    expect(panel).toContain("What needs fixing");
    expect(panel).toContain("it cannot claim an order or contact Stripe");
  });

  it("offers an explicit no-charge live webhook verification", () => {
    const panel = read("../../components/admin/billing-automation-panel.tsx");
    const route = read("../../app/api/admin/billing-automation/route.ts");
    const verification = read(
      "../billing/stripe-live-webhook-verification.ts",
    );

    expect(panel).toContain('body: JSON.stringify({ action: "verify_webhook" })');
    expect(panel).toContain("Verify live webhook (no charge)");
    expect(route).toContain("requestStripeLiveWebhookVerification");
    expect(verification).toContain("stripe.setupIntents.create");
    expect(verification).toContain("stripe.setupIntents.cancel");
    expect(verification).not.toContain("paymentIntents.create");
  });

  it("explains late discovery and exact retries without implying catch-up billing", () => {
    const panel = read("../../components/admin/billing-automation-panel.tsx");

    expect(panel).toContain(
      "A first-ever service-month charge discovered after the 1st stays in",
    );
    expect(panel).toContain("Atlas does not silently catch it");
    expect(panel).toContain("already-locked failed order");
  });

  it("shows an actionable error when automation controls fail to load", () => {
    const page = read("../../components/admin/billing-workspace-page.tsx");

    expect(page).toContain("Automation unavailable");
    expect(page).toContain("Billing controls did not load");
    expect(page).toContain("Reload billing controls");
    expect(page).toContain("setAutomationError");
  });

  it("requires a paired property and priced unbilled Jobber visit", () => {
    const server = read("./billing-workspace-server.ts");

    expect(server).toContain('.from("jobber_property_links")');
    expect(server).toContain('.from("jobber_visit_projections")');
    expect(server).toContain("projection.job_total_cents > 0");
    expect(server).toContain("projection.job_will_auto_charge === false");
    expect(server).toContain("projection.visit_invoice_id === null");
    expect(server).toContain('projection.visit_invoice_status === "NONE"');
    expect(server).toContain("verifiedServiceVisitReady: Boolean(nextAppointment)");
  });

  it("does not offer a futile founder retry when the customer must approve", () => {
    const table = read("../../components/admin/billing-register-table.tsx");
    const server = read("./billing-workspace-server.ts");

    expect(server).toContain("failure_code");
    expect(table).toContain("customerBankApprovalRequired");
    expect(table).toContain("Customer approval required");
    expect(table).toContain("Atlas will not retry it");
  });

  it("offers the hosted Stripe email only when the exact enrollment checks pass", () => {
    const table = read("../../components/admin/billing-register-table.tsx");
    const server = read("./billing-workspace-server.ts");

    expect(table).toContain("PaymentSetupEmailButton");
    expect(table).toContain('row.paymentSetupEmailState === "ready"');
    expect(table).toContain("Email secure Stripe link");
    expect(server).toContain("resolvePaymentSetupEmailState");
    expect(server).toContain("resolveMemberEmail");
  });

  it("keeps the exact Today handoff review-only and fails closed on visit mismatch", () => {
    const today = read("../../components/admin/today-workspace-page.tsx");
    const page = read("../../components/admin/billing-workspace-page.tsx");
    const table = read("../../components/admin/billing-register-table.tsx");

    expect(today).toContain("billingTodayReviewHref");
    expect(today).toContain("Review payment readiness");
    expect(page).toContain(
      "row?.nextAppointmentId === focus.appointmentId",
    );
    expect(page).toContain(
      "Opening this review never sends an email and never charges a card.",
    );
    expect(table).not.toContain("CompleteChargeVisitModal");
  });

  it("keeps a proven completed visit attached to current-month owner review", () => {
    const server = read("./billing-workspace-server.ts");
    const selection = read("./billing-visit-selection.ts");

    expect(server).toContain("selectBillingWorkspaceVisit");
    expect(server).toContain("completedEvidenceByAppointmentId");
    expect(server).toContain('customer_note_visible');
    expect(server).toContain('.eq("customer_visible", true)');
    expect(selection).toContain('appointment.status !== "completed"');
    expect(selection).toContain("evidence?.hasFieldRecord");
    expect(selection).toContain("evidence.hasCustomerVisibleUpdate");
    expect(selection).toContain("!evidence.hasOpenFollowUp");
  });
});
