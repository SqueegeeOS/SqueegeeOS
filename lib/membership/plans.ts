import type { HomeCarePlanData } from "@/lib/home-care-plan/canyon-oaks";
import type { MembershipPlanId, MembershipSignature } from "./types";

/** Map plan display data + future Stripe Price IDs */
export function getMembershipPlans(data: HomeCarePlanData) {
  return data.memberships.map((tier) => ({
    ...tier,
    /** Stripe Price ID — set when Stripe products are configured */
    stripePriceId: null as string | null,
    planId: tier.id as MembershipPlanId,
    isRecurring: tier.period === "per month",
  }));
}

export function buildCheckoutPayload(
  data: HomeCarePlanData,
  planId: MembershipPlanId,
  signature: MembershipSignature,
) {
  return {
    planId,
    signature,
    propertySlug: data.property.slug,
    propertyName: data.property.name,
    homeownerSlug: data.homeowner.slug,
    homeownerName: data.homeowner.fullName,
  };
}
