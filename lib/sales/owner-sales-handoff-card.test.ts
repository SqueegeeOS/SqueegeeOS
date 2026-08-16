import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SignedHandoffCard } from "@/components/admin/owner-sales-inbox-page";
import type { OwnerSalesPipelineHandoff } from "./owner-pipeline";

function handoff(
  overrides: Partial<OwnerSalesPipelineHandoff> = {},
): OwnerSalesPipelineHandoff {
  return {
    attributionId: "attribution-1",
    membershipId: "membership-1",
    homeownerName: "Mandi Rivera",
    propertyAddress: "88 Oak Way",
    attributedArrCents: 120_000,
    attributedAt: "2026-08-16T17:00:00.000Z",
    paymentSetupEmailState: "ready",
    stage: "payment_needed",
    label: "Payment setup needed",
    detail: "Verified payment handoff.",
    completedSteps: 1,
    totalSteps: 5,
    actionLabel: "Open member record",
    actionHref: "/hq/customers/membership/membership-1",
    nextScheduledAt: null,
    scheduleObservedAt: null,
    repId: "rep-david",
    repSlug: "david",
    repDisplayName: "David",
    repWorkspacePath: "/david",
    ...overrides,
  };
}

describe("owner signed-close payment handoff", () => {
  it("renders one explicit charge-free Stripe email action when proof is ready", () => {
    const html = renderToStaticMarkup(
      createElement(SignedHandoffCard, {
        handoff: handoff(),
        onAccepted: () => undefined,
      }),
    );

    expect(html).toContain("Email secure Stripe link");
    expect(html).toContain("Stripe saves the card; no charge occurs");
    expect(html).toContain("Text remains locked until Twilio approval");
    expect(html).not.toContain("disabled=\"\"");
  });

  it("withholds the email control when customer-email proof needs attention", () => {
    const html = renderToStaticMarkup(
      createElement(SignedHandoffCard, {
        handoff: handoff({
          stage: "membership_attention",
          paymentSetupEmailState: "needs_email",
          label: "Customer email needed",
          actionLabel: "Add customer email",
        }),
        onAccepted: () => undefined,
      }),
    );

    expect(html).not.toContain("Email secure Stripe link");
    expect(html).toContain("Add customer email");
  });
});
