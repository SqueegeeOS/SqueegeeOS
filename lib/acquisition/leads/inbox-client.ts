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

export async function removeLeadIntakeFromActiveHqClient(
  id: string,
): Promise<LeadIntakeRecord> {
  const response = await fetch(`/api/admin/lead-intakes/${id}/remove`, {
    method: "POST",
    headers: getAdminRequestHeaders(),
  });

  const data = (await response.json().catch(() => null)) as {
    lead?: LeadIntakeRecord;
    error?: string;
  } | null;
  if (!response.ok || !data?.lead) {
    throw new Error(data?.error ?? "Failed to remove test or fake request");
  }
  return data.lead;
}

export async function schedulePresentationFromLead(
  lead: LeadIntakeRecord,
): Promise<string> {
  const createResponse = await fetch("/api/presentations", {
    method: "POST",
    headers: getAdminRequestHeaders(),
    body: JSON.stringify({
      leadIntakeId: lead.id,
    }),
  });

  if (!createResponse.ok) {
    const body = (await createResponse.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? "Failed to prepare presentation");
  }

  const { presentation, leadStatusSynced } = (await createResponse.json()) as {
    presentation: { id: string; status: string };
    leadStatusSynced?: boolean;
  };
  const href =
    presentation.status === "signed"
      ? `/presentations/${presentation.id}/present`
      : `/presentations/${presentation.id}/edit`;
  return leadStatusSynced === false ? `${href}?inquirySync=pending` : href;
}
