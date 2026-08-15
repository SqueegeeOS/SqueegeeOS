import type {
  SalesLeadActionMoment,
  SalesLeadActionQueueItem,
} from "./lead-action-priority";

export type SalesLeadQueueFilter =
  | "all"
  | "needs_action"
  | SalesLeadActionMoment;

interface FilterSalesLeadActionQueueInput {
  filter: SalesLeadQueueFilter;
  query: string;
}

function normalizeSearchValue(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9@+]+/g, " ")
    .trim();
}

function matchesFilter(
  moment: SalesLeadActionMoment,
  filter: SalesLeadQueueFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "needs_action") return moment !== "upcoming";
  return moment === filter;
}

export function filterSalesLeadActionQueue(
  queue: SalesLeadActionQueueItem[],
  { filter, query }: FilterSalesLeadActionQueueInput,
): SalesLeadActionQueueItem[] {
  const searchTerms = normalizeSearchValue(query).split(" ").filter(Boolean);

  return queue.filter(({ lead, moment }) => {
    if (!matchesFilter(moment, filter)) return false;
    if (searchTerms.length === 0) return true;

    const searchableLead = normalizeSearchValue(
      [
        lead.fullName,
        lead.propertyAddress,
        lead.phone ?? "",
        lead.email ?? "",
      ].join(" "),
    );
    return searchTerms.every((term) => searchableLead.includes(term));
  });
}
