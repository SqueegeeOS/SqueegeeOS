import type { PaymentRail } from "@/lib/billing/payment-rail";
import {
  DEFAULT_PAYMENT_RAIL,
  isPaymentRail,
} from "@/lib/billing/payment-rail";
import type { SqueegeeKingTierId } from "@/lib/membership/tier-config";
import type { EnrollmentSalesContext } from "./types";

export interface EnrollmentSubmission {
  presentationId: string;
  tier: SqueegeeKingTierId;
  firstVisitPrice: number;
  recurringVisitPrice: number;
  annualizedValue: number;
  salesContext: EnrollmentSalesContext;
  homeSolicitationNoticeDays: 3 | 5 | null;
  paymentRail: PaymentRail;
}

export type EnrollmentSubmissionParseResult =
  | { ok: true; value: EnrollmentSubmission }
  | { ok: false; presentationId: string };

function positivePrice(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 1_000_000
    ? Math.round(parsed * 100) / 100
    : null;
}

function tier(value: unknown): SqueegeeKingTierId | null {
  return value === "biannual" || value === "triannual" || value === "quarterly"
    ? value
    : null;
}

function salesContext(value: unknown): EnrollmentSalesContext | null {
  return value === "customer_home" ||
    value === "business_premises" ||
    value === "remote" ||
    value === "other"
    ? value
    : null;
}

export function parseEnrollmentSubmission(
  body: Record<string, unknown>,
): EnrollmentSubmissionParseResult {
  const presentationId =
    typeof body.presentationId === "string" ? body.presentationId.trim() : "";
  const selectedTier = tier(body.tier);
  const firstVisitPrice = positivePrice(body.firstVisitPrice);
  const recurringVisitPrice = positivePrice(body.recurringVisitPrice);
  const annualizedValue = positivePrice(body.annualizedValue);
  const context = salesContext(body.salesContext);
  const paymentRail =
    body.paymentRail === undefined
      ? DEFAULT_PAYMENT_RAIL
      : isPaymentRail(body.paymentRail)
        ? body.paymentRail
        : null;
  const noticeDays =
    body.homeSolicitationNoticeDays === 3 ||
    body.homeSolicitationNoticeDays === 5
      ? body.homeSolicitationNoticeDays
      : null;

  if (
    !presentationId ||
    !selectedTier ||
    !firstVisitPrice ||
    !recurringVisitPrice ||
    !annualizedValue ||
    !context ||
    !paymentRail
  ) {
    return { ok: false, presentationId };
  }

  return {
    ok: true,
    value: {
      presentationId,
      tier: selectedTier,
      firstVisitPrice,
      recurringVisitPrice,
      annualizedValue,
      salesContext: context,
      homeSolicitationNoticeDays:
        context === "customer_home" ? noticeDays : null,
      paymentRail,
    },
  };
}
