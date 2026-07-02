import type { MembershipPlanId } from "@/lib/membership/types";

export type MembershipStatus =
  | "inactive"
  | "pending_checkout"
  | "active"
  | "paused"
  | "cancelled";

/**
 * Persisted membership — maps to `memberships` table in Supabase.
 * Links a homeowner + property to a plan tier and future Stripe subscription.
 */
export interface PersistedMembership {
  id: string;
  homeownerId: string;
  propertyId: string;
  homeCarePlanId: string | null;
  planId: MembershipPlanId;
  planName: string;
  priceDisplay: string;
  billingPeriod: string;
  status: MembershipStatus;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  startedAt: string | null;
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
