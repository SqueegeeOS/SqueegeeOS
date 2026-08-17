import type { BillingRegisterRow } from "@/lib/admin/billing-workspace-types";
import type { MembershipMemberRow } from "@/lib/admin/membership-command-center-types";

export interface AtlasMemberMatch {
  membershipId: string | null;
  homeownerName: string;
  planType: MembershipMemberRow["planType"];
  membershipStatus: string | null;
  paymentStatus: MembershipMemberRow["paymentStatus"];
  nextServiceLabel: string | null;
  healthBadges: MembershipMemberRow["healthBadges"];
  missingFlags: string[];
  workspaceUrl: string | null;
}

export interface AtlasChargeReview {
  kind: "charge_review";
  executionAllowed: false;
  requestedAmount: number;
  reason: string;
  matchState: "exact" | "ambiguous" | "not_found";
  member: {
    homeownerName: string;
    membershipId: string;
    tierLabel: string;
    billingStatus: BillingRegisterRow["billingStatus"];
    paymentStatus: BillingRegisterRow["stripePaymentStatus"];
    cardOnFileLabel: string | null;
    expectedAmount: number | null;
    nextAppointmentDate: string | null;
  } | null;
  warnings: string[];
  candidateNames: string[];
  reviewUrl: string;
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

export function findMemberMatches(
  rows: MembershipMemberRow[],
  query: string,
  limit = 6,
): AtlasMemberMatch[] {
  const needle = normalized(query);
  if (needle.length < 2) return [];

  return rows
    .filter((row) => normalized(row.homeownerName).includes(needle))
    .slice(0, limit)
    .map((row) => ({
      membershipId: row.membershipId,
      homeownerName: row.homeownerName,
      planType: row.planType,
      membershipStatus: row.membershipStatus,
      paymentStatus: row.paymentStatus,
      nextServiceLabel: row.nextServiceLabel,
      healthBadges: row.healthBadges,
      missingFlags: row.missingFlags,
      workspaceUrl:
        row.membershipId && row.propertyId
          ? `/hq/customers/membership/${encodeURIComponent(row.membershipId)}`
          : null,
    }));
}

export function prepareChargeReview(
  rows: BillingRegisterRow[],
  customerName: string,
  amount: number,
  reason: string,
): AtlasChargeReview {
  const needle = normalized(customerName);
  const candidates = rows.filter((row) =>
    normalized(row.homeownerName).includes(needle),
  );
  const exact = candidates.filter(
    (row) => normalized(row.homeownerName) === needle,
  );
  const selected = exact.length === 1
    ? exact[0]
    : candidates.length === 1
      ? candidates[0]
      : null;

  if (!selected) {
    return {
      kind: "charge_review",
      executionAllowed: false,
      requestedAmount: amount,
      reason,
      matchState: candidates.length > 1 ? "ambiguous" : "not_found",
      member: null,
      warnings: [
        candidates.length > 1
          ? "More than one member matched. Use the full customer name before reviewing a charge."
          : "No active or pending billing member matched that name.",
      ],
      candidateNames: candidates.slice(0, 6).map((row) => row.homeownerName),
      reviewUrl: "/hq/billing",
    };
  }

  const expectedAmount =
    selected.jobberScheduledAmount ?? selected.visitPrice ?? null;
  const warnings: string[] = [];

  if (selected.stripePaymentStatus !== "card_on_file") {
    warnings.push("No verified card is on file.");
  }
  if (!selected.billingAuthorizationReady) {
    warnings.push("The signed billing authorization is missing or does not match the membership.");
  }
  if (!selected.verifiedServiceVisitReady) {
    warnings.push("No verified scheduled Jobber visit supports this charge.");
  }
  if (selected.periodAlreadyPaid || selected.billingStatus === "charged") {
    warnings.push("This billing period is already marked paid or charged.");
  }
  if (expectedAmount === null) {
    warnings.push("HomeAtlas has no verified Jobber or membership amount for comparison.");
  } else if (Math.abs(expectedAmount - amount) >= 0.01) {
    warnings.push(
      `The requested $${amount.toFixed(2)} does not match the verified $${expectedAmount.toFixed(2)} service amount.`,
    );
  }
  if (!selected.canRecordCharge) {
    warnings.push("The existing HomeAtlas billing workflow does not currently mark this member ready to charge.");
  }

  return {
    kind: "charge_review",
    executionAllowed: false,
    requestedAmount: amount,
    reason,
    matchState: "exact",
    member: {
      homeownerName: selected.homeownerName,
      membershipId: selected.membershipId,
      tierLabel: selected.tierLabel,
      billingStatus: selected.billingStatus,
      paymentStatus: selected.stripePaymentStatus,
      cardOnFileLabel: selected.cardOnFileLabel,
      expectedAmount,
      nextAppointmentDate: selected.nextAppointmentDate,
    },
    warnings,
    candidateNames: [],
    reviewUrl: `/hq/billing?membershipId=${encodeURIComponent(selected.membershipId)}`,
  };
}
