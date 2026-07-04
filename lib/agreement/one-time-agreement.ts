import type { MembershipPlanId } from "@/lib/membership/types";

export type AgreementKind = "membership" | "one_time";

export const ONE_TIME_AGREEMENT_TEMPLATE = "one-time-service-agreement.pdf";

export const ONE_TIME_AGREEMENT_TITLE =
  "SqueegeeKing One-Time Exterior Service Agreement";

export const ONE_TIME_SUMMARY_POINTS = [
  "One scheduled service visit at the agreed price",
  "Scope limited to exterior services quoted for this visit only",
  "7-Day Workmanship Guarantee on completed work",
  "This is not a membership — no recurring visits or automatic scheduling",
  "No member portal, priority booking, or add-on discounts apply",
] as const;

export const ONE_TIME_SERVICE_SCOPE = [
  "Exterior window cleaning as quoted for this visit",
  "Standard workmanship and site cleanup upon completion",
  "RainBlock, Hard Water treatments, and interior glass only if explicitly quoted",
  "Screens, tracks, gutters, and pressure washing only if listed on this quote",
] as const;

export function isOneTimePlanId(planId?: string | null): boolean {
  return planId === "one-time";
}

export function agreementKindForPlan(
  planId?: MembershipPlanId | string | null,
): AgreementKind {
  return isOneTimePlanId(planId) ? "one_time" : "membership";
}

export function planNameForOneTimeAgreement(): string {
  return ONE_TIME_AGREEMENT_TITLE;
}

export function oneTimeAgreementTemplatePath(): string {
  return `/documents/${ONE_TIME_AGREEMENT_TEMPLATE}`;
}
