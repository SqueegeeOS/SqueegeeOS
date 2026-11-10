export interface PortalPlannedVisit {
  sequence: number;
  priceCents: number;
  serviceSummary: string;
}

export interface PortalVisitPricing {
  visits: PortalPlannedVisit[];
  annualTotalCents: number;
}

function record(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

const SERVICE_LABELS = [
  ["solarPanels", "Solar panel cleaning"],
  ["exteriorWindows", "exterior window cleaning"],
  ["screens", "standard window-screen cleaning"],
  ["interiorWindows", "interior window cleaning"],
  ["cobwebRemoval", "cobweb removal"],
  ["pressureWashing", "pressure washing"],
] as const;

/** Read-only display projection. Never use an average as a visit charge. */
export function signedPortalVisitPricing(
  snapshot: unknown,
  expectedVisitsPerYear: number | null,
): PortalVisitPricing | null {
  const plan = record(record(snapshot)?.plan);
  if (
    !plan ||
    !Array.isArray(plan.visits) ||
    plan.visits.length === 0 ||
    plan.visits.length > 12 ||
    plan.visits.length !== plan.visitsPerYear ||
    (expectedVisitsPerYear != null && plan.visits.length !== expectedVisitsPerYear)
  ) return null;

  const visits: PortalPlannedVisit[] = [];
  for (const [index, value] of plan.visits.entries()) {
    const visit = record(value);
    if (
      !visit ||
      typeof visit.priceCents !== "number" ||
      !Number.isSafeInteger(visit.priceCents) ||
      visit.priceCents <= 0
    ) return null;
    const services = SERVICE_LABELS
      // Legacy enrollment snapshots default exterior windows to included.
      .filter(([key]) => (visit[key] ?? (key === "exteriorWindows" ? "included" : "not_included")) === "included")
      .map(([, label]) => label);
    visits.push({
      sequence: index + 1,
      priceCents: visit.priceCents,
      serviceSummary: services.join(" + ") ||
        (typeof visit.label === "string" ? visit.label.trim() : "Planned care visit"),
    });
  }

  const annualTotalCents = visits.reduce((sum, visit) => sum + visit.priceCents, 0);
  if (
    !Number.isSafeInteger(annualTotalCents) ||
    annualTotalCents !== plan.annualizedValueCents
  ) return null;
  return { visits, annualTotalCents };
}
