import type { SalesRepRecentWin } from "./workspace-types";
import type { SalesProductionHandoffRecord } from "./production-handoff";

export interface SalesRepWinAttributionSource {
  id: string;
  membershipId: string | null;
  leadId: string | null;
  presentationId: string | null;
  attributedArrCents: number;
  status: "pending" | "active" | "qualified" | "cancelled";
  attributedAt: string;
}

export interface SalesRepWinLeadIdentity {
  id: string;
  fullName: string;
  propertyAddress: string;
}

export interface SalesRepWinPresentationIdentity {
  id: string;
  clientName: string;
  clientAddress: string;
}

function timestamp(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

export function selectRecentSalesRepWinSources(
  attributions: SalesRepWinAttributionSource[],
  limit = 6,
): SalesRepWinAttributionSource[] {
  const boundedLimit = Math.min(20, Math.max(1, Math.floor(limit)));
  return attributions
    .filter((attribution) => attribution.status !== "cancelled")
    .sort((left, right) => {
      const leftTimestamp = timestamp(left.attributedAt);
      const rightTimestamp = timestamp(right.attributedAt);
      return leftTimestamp !== rightTimestamp
        ? rightTimestamp - leftTimestamp
        : left.id.localeCompare(right.id);
    })
    .slice(0, boundedLimit);
}

export function buildSalesRepRecentWins(input: {
  attributions: SalesRepWinAttributionSource[];
  leads: SalesRepWinLeadIdentity[];
  presentations: SalesRepWinPresentationIdentity[];
  productionHandoffs: SalesProductionHandoffRecord[];
}): SalesRepRecentWin[] {
  const leadsById = new Map(input.leads.map((lead) => [lead.id, lead]));
  const presentationsById = new Map(
    input.presentations.map((presentation) => [presentation.id, presentation]),
  );
  const productionHandoffByAttributionId = new Map(
    input.productionHandoffs.map((handoff) => [handoff.attributionId, handoff]),
  );

  return input.attributions.map((attribution) => {
    const lead = attribution.leadId
      ? leadsById.get(attribution.leadId)
      : undefined;
    const presentation = attribution.presentationId
      ? presentationsById.get(attribution.presentationId)
      : undefined;
    const fullName =
      lead?.fullName.trim() ||
      presentation?.clientName.trim() ||
      "Signed homeowner";
    const propertyAddress =
      lead?.propertyAddress.trim() ||
      presentation?.clientAddress.trim() ||
      "Service property on file";

    return {
      id: attribution.id,
      fullName,
      propertyAddress,
      attributedArrCents: Math.max(
        0,
        Number.isFinite(attribution.attributedArrCents)
          ? attribution.attributedArrCents
          : 0,
      ),
      status: attribution.status as SalesRepRecentWin["status"],
      attributedAt: attribution.attributedAt,
      productionHandoff:
        productionHandoffByAttributionId.get(attribution.id) ?? null,
    };
  });
}
