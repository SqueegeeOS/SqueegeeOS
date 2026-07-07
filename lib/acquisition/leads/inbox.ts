import type { LeadIntakeRecord, LeadIntakeStatus } from "@/lib/acquisition/lead-record";

export type LeadIntakeFilter = LeadIntakeStatus | "all";

export function formatLeadIntakeStatus(status: LeadIntakeStatus): string {
  switch (status) {
    case "new":
      return "New";
    case "contacted":
      return "Contacted";
    case "scheduled":
      return "Scheduled";
    case "archived":
      return "Archived";
  }
}

export function formatLeadSubmittedAt(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function matchesLeadSearch(lead: LeadIntakeRecord, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const haystack = [
    lead.name,
    lead.phone,
    lead.email,
    lead.serviceAddress,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}

export function filterLeads(
  leads: LeadIntakeRecord[],
  statusFilter: LeadIntakeFilter,
  searchQuery: string,
): LeadIntakeRecord[] {
  return leads.filter((lead) => {
    if (statusFilter !== "all" && lead.status !== statusFilter) {
      return false;
    }
    return matchesLeadSearch(lead, searchQuery);
  });
}
