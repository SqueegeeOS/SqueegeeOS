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

/** Scanning-friendly relative time for the requests inbox. */
export function formatLeadSubmittedRelative(iso: string): string {
  const date = new Date(iso);
  const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  const absSec = Math.abs(diffSec);
  if (absSec < 60) return rtf.format(diffSec, "second");

  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");

  const diffHour = Math.round(diffSec / 3600);
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, "hour");

  const diffDay = Math.round(diffSec / 86400);
  if (Math.abs(diffDay) < 7) return rtf.format(diffDay, "day");

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
