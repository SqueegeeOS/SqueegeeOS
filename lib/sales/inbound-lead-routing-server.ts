import "server-only";

import {
  assignLeadIntakeToSalesRep,
  loadLeadIntakeSalesAssignment,
} from "./lead-intake-assignment-server";
import {
  configuredInboundLeadOwnerSlug,
  inboundLeadNextFollowUpAt,
} from "./inbound-lead-routing";
import type { LeadIntakeSalesAssignment } from "./lead-intake-assignment";

export type InboundLeadRoutingResult =
  | { status: "not_configured"; assignment: null }
  | { status: "already_owned"; assignment: LeadIntakeSalesAssignment }
  | { status: "assigned"; assignment: LeadIntakeSalesAssignment };

export async function routeInboundLeadToConfiguredOwner(input: {
  leadIntakeId: string;
  reference?: Date;
  environment?: Record<string, string | undefined>;
}): Promise<InboundLeadRoutingResult> {
  const ownerSlug = configuredInboundLeadOwnerSlug(input.environment);
  if (!ownerSlug) return { status: "not_configured", assignment: null };

  const existing = await loadLeadIntakeSalesAssignment(input.leadIntakeId);
  if (existing) return { status: "already_owned", assignment: existing };

  const assignment = await assignLeadIntakeToSalesRep({
    leadIntakeId: input.leadIntakeId,
    repSlug: ownerSlug,
    nextFollowUpAt: inboundLeadNextFollowUpAt(input.reference),
  });
  return { status: "assigned", assignment };
}
