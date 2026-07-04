import type { SqueegeeKingTierId } from "@/lib/membership/tier-config";
import {
  buildSqueegeeKingTierQuote,
  normalizeToSqueegeeKingTier,
} from "@/lib/membership/tier-config";
import type { LeadIntakeFormData } from "./types";
import { emptyLeadForm } from "./types";

export interface RequestUrlParams {
  membershipTier: SqueegeeKingTierId | null;
  squareFootage: number | null;
}

export function parseRequestSearchParams(
  searchParams: URLSearchParams,
): RequestUrlParams {
  const membership = searchParams.get("membership");
  const sqftRaw = searchParams.get("sqft");

  let squareFootage: number | null = null;
  if (sqftRaw) {
    const parsed = parseInt(sqftRaw.replace(/\D/g, ""), 10);
    if (parsed > 0) squareFootage = parsed;
  }

  return {
    membershipTier: membership
      ? normalizeToSqueegeeKingTier(membership)
      : null,
    squareFootage,
  };
}

export function buildLeadFormFromParams(
  params: RequestUrlParams,
): LeadIntakeFormData {
  const form: LeadIntakeFormData = {
    ...emptyLeadForm,
    squareFootage: params.squareFootage,
    membershipTier: params.membershipTier,
  };

  if (!params.membershipTier) return form;

  const tier = params.membershipTier;
  const label = buildSqueegeeKingTierQuote(tier, params.squareFootage ?? 2500)
    .label;
  const noteLine = `Interested in ${label} membership.`;

  return {
    ...form,
    servicesInterested: ["Full Home Care Membership"],
    notes: noteLine,
  };
}

export function estimatedPriceForLead(
  tier: SqueegeeKingTierId | null,
  squareFootage: number | null,
): number | null {
  if (!tier) return null;
  return buildSqueegeeKingTierQuote(tier, squareFootage ?? 2500).visitPrice;
}
