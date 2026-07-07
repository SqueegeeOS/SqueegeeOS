import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import type { LeadIntakeRecord, LeadIntakeStatus } from "@/lib/acquisition/lead-record";

export async function updateLeadIntakeStatusClient(
  id: string,
  status: LeadIntakeStatus,
): Promise<LeadIntakeRecord> {
  const response = await fetch(`/api/admin/lead-intakes/${id}`, {
    method: "PATCH",
    headers: getAdminRequestHeaders(),
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw new Error("Failed to update request");
  }

  const data = (await response.json()) as { lead: LeadIntakeRecord };
  return data.lead;
}

export async function schedulePresentationFromLead(
  lead: LeadIntakeRecord,
): Promise<string> {
  await updateLeadIntakeStatusClient(lead.id, "scheduled");

  const createResponse = await fetch("/api/presentations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientName: lead.name,
      createdBy: "HQ Request",
      tier: lead.membershipTier ?? "quarterly",
      homeSqft: lead.squareFootage ?? undefined,
    }),
  });

  if (!createResponse.ok) {
    throw new Error("Failed to create presentation");
  }

  const { presentation } = (await createResponse.json()) as {
    presentation: { id: string };
  };

  const patchResponse = await fetch(`/api/presentations/${presentation.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientEmail: lead.email,
      clientAddress: lead.serviceAddress,
    }),
  });

  if (!patchResponse.ok) {
    throw new Error("Failed to prefill presentation");
  }

  return `/presentations/${presentation.id}/edit`;
}
