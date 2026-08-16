import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function projectFile(relativePath: string): string {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
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

  it("surfaces the email action in the live HQ member cards", () => {
    const page = projectFile("components/admin/hq-memberships-page.tsx");
    expect(page).toContain("PaymentSetupEmailButton");
    expect(page).toContain("!row.cardOnFile");
    expect(page).toContain("membershipId={row.id}");
    expect(page).toContain("canSend={Boolean(row.agreementId)}");
  });
});
