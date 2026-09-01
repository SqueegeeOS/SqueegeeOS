import { describe, expect, it } from "vitest";
import type { BillingRegisterRow } from "@/lib/admin/billing-workspace-types";
import type { MembershipMemberRow } from "@/lib/admin/membership-command-center-types";
import {
  findMemberMatches,
  prepareChargeReview,
} from "@/lib/concierge/operator-tools-core";

function billingRow(
  overrides: Partial<BillingRegisterRow> = {},
): BillingRegisterRow {
  return {
    membershipId: "membership-1",
    homeownerId: "homeowner-1",
    propertyId: "property-1",
    homeownerName: "Shelby Holland",
    propertyLabel: "Private property label",
    tierLabel: "Bi-Annual",
    visitPrice: 333,
    jobberScheduledAmount: 333,
    enrollmentSavingsPerVisit: null,
    nextAppointmentId: "appointment-1",
    nextAppointmentDate: "2026-08-20T17:00:00.000Z",
    stripePaymentStatus: "card_on_file",
    paymentSetupEmailState: "card_on_file",
    paymentSetupEmailRecipient: null,
    cardOnFileLabel: "Visa ending 6317",
    stripeCustomerId: "cus_private",
    nextChargeDate: "2026-08-20",
    lastChargeDate: null,
    billingPeriod: "2026-08-01",
    periodAlreadyPaid: false,
    canRecordCharge: true,
    billingStatus: "ready_to_charge",
    agreementId: "agreement-1",
    agreementPdfUrl: null,
    chargeAction: "complete_and_charge",
    automaticBillingEnabled: false,
    billingAuthorizationReady: true,
    jobberPropertyPaired: true,
    verifiedServiceVisitReady: true,
    billingOrderId: null,
    billingExecutionState: null,
    billingFailureCode: null,
    billingFailureMessage: null,
    billingAttemptCount: 0,
    billingNextAttemptAt: null,
    ...overrides,
  };
}

function memberRow(
  overrides: Partial<MembershipMemberRow> = {},
): MembershipMemberRow {
  return {
    membershipId: "membership-1",
    presentationId: "presentation-1",
    homeownerId: "homeowner-1",
    propertyId: "property-1",
    homeownerName: "Shelby Holland",
    propertyName: "Residence",
    propertyLabel: "Private property label",
    homeownerSlug: "shelby-holland",
    propertySlug: "residence",
    planType: "Bi-Annual",
    visitPrice: 333,
    yearlyValue: 666,
    visitsPerYear: 2,
    nextServiceDate: "2026-08-20",
    nextServiceLabel: "Aug 20, 2026",
    paymentStatus: "card_on_file",
    cardLabel: "Visa ending 6317",
    paymentRail: "stripe_card",
    membershipStatus: "active",
    healthBadges: ["active"],
    missingFlags: [],
    portalUrl: "/portal/private",
    agreementId: "agreement-1",
    agreementPdfUrl: null,
    foundingMember: false,
    isActive: true,
    pendingReason: null,
    ...overrides,
  };
}

describe("Atlas operator tools", () => {
  it("returns a minimal member record without contact or address fields", () => {
    const [match] = findMemberMatches([memberRow()], "shelby");

    expect(match.homeownerName).toBe("Shelby Holland");
    expect(match.workspaceUrl).toBe(
      "/hq/customers/membership/membership-1",
    );
    expect(match).not.toHaveProperty("propertyLabel");
    expect(match).not.toHaveProperty("cardLabel");
    expect(match).not.toHaveProperty("portalUrl");
  });

  it("prepares a matching review but never authorizes execution", () => {
    const review = prepareChargeReview(
      [billingRow()],
      "Shelby Holland",
      333,
      "Completed exterior service",
    );

    expect(review.matchState).toBe("exact");
    expect(review.executionAllowed).toBe(false);
    expect(review.warnings).toEqual([]);
    expect(review.reviewUrl).toContain("membership-1");
  });

  it("surfaces every unsafe billing mismatch instead of approving it", () => {
    const review = prepareChargeReview(
      [
        billingRow({
          visitPrice: 282,
          jobberScheduledAmount: null,
          stripePaymentStatus: "customer_only",
          billingAuthorizationReady: false,
          verifiedServiceVisitReady: false,
          periodAlreadyPaid: true,
          canRecordCharge: false,
          billingStatus: "charged",
        }),
      ],
      "Shelby Holland",
      333,
      "Unverified service",
    );

    expect(review.executionAllowed).toBe(false);
    expect(review.warnings).toEqual(
      expect.arrayContaining([
        "No verified card is on file.",
        "The signed billing authorization is missing or does not match the membership.",
        "No verified scheduled Jobber visit supports this charge.",
        "This billing period is already marked paid or charged.",
        "The requested $333.00 does not match the verified $282.00 service amount.",
      ]),
    );
  });

  it("requires an unambiguous member match", () => {
    const review = prepareChargeReview(
      [
        billingRow({ homeownerName: "Shelby Holland" }),
        billingRow({
          membershipId: "membership-2",
          homeownerName: "Shelby Weaver",
        }),
      ],
      "Shelby",
      333,
      "Service",
    );

    expect(review.matchState).toBe("ambiguous");
    expect(review.member).toBeNull();
    expect(review.executionAllowed).toBe(false);
  });
});
