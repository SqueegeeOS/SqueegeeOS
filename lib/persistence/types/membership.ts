import type { MembershipPlanId } from "@/lib/membership/types";

export type MembershipStatus =
  | "inactive"
  | "pending_checkout"
  | "pending_payment"
  | "active"
  | "paused"
  | "cancelled";

export type MembershipBillingSchedule = "first_of_service_month";

export type MembershipSalesTier = "biannual" | "quarterly";

/**
 * Persisted membership — maps to `memberships` table in Supabase.
 * Links a homeowner + property to a plan tier and future Stripe subscription.
 */
export interface PersistedMembership {
  id: string;
  homeownerId: string;
  propertyId: string;
  homeCarePlanId: string | null;
  presentationId: string | null;
  agreementId: string | null;
  planId: MembershipPlanId;
  planName: string;
  priceDisplay: string;
  billingPeriod: string;
  salesTier: MembershipSalesTier | null;
  visitPrice: number | null;
  annualRate: number | null;
  visitsPerYear: number | null;
  billingSchedule: MembershipBillingSchedule;
  nextBillingDate: string | null;
  paymentSetupCompletedAt: string | null;
  status: MembershipStatus;
  stripeCustomerId: string | null;
  stripePaymentMethodId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  startedAt: string | null;
  /** Early launch founding cohort — set at creation only */
  foundingMember: boolean;
  foundingMemberSince: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PersistedMembershipInput = Omit<
  PersistedMembership,
  "id" | "createdAt" | "updatedAt"
> & {
  id?: string;
};
