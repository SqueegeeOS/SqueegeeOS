export const INBOUND_LEAD_OWNER_ENV = "INBOUND_LEAD_OWNER_SLUG";
export const INBOUND_LEAD_FOLLOW_UP_MINUTES = 15;

const REP_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type InboundLeadRoutingStatus =
  | "active"
  | "not_configured"
  | "owner_unavailable";

export interface InboundLeadRoutingRep {
  slug: string;
  displayName: string;
}

export interface InboundLeadRoutingSnapshot {
  status: InboundLeadRoutingStatus;
  ownerSlug: string | null;
  ownerDisplayName: string | null;
  followUpMinutes: number;
}

export function normalizeInboundLeadOwnerSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const slug = value.trim().toLowerCase();
  return slug.length <= 80 && REP_SLUG_PATTERN.test(slug) ? slug : null;
}

export function configuredInboundLeadOwnerSlug(
  environment: Record<string, string | undefined> = process.env,
): string | null {
  return normalizeInboundLeadOwnerSlug(environment[INBOUND_LEAD_OWNER_ENV]);
}

export function resolveInboundLeadRouting(
  reps: InboundLeadRoutingRep[],
  configuredValue: unknown,
): InboundLeadRoutingSnapshot {
  const configuredText =
    typeof configuredValue === "string" ? configuredValue.trim() : "";
  if (!configuredText) {
    return {
      status: "not_configured",
      ownerSlug: null,
      ownerDisplayName: null,
      followUpMinutes: INBOUND_LEAD_FOLLOW_UP_MINUTES,
    };
  }

  const ownerSlug = normalizeInboundLeadOwnerSlug(configuredText);
  const owner = ownerSlug
    ? reps.find((rep) => rep.slug.trim().toLowerCase() === ownerSlug)
    : null;

  return {
    status: owner ? "active" : "owner_unavailable",
    ownerSlug,
    ownerDisplayName: owner?.displayName ?? null,
    followUpMinutes: INBOUND_LEAD_FOLLOW_UP_MINUTES,
  };
}

export function inboundLeadNextFollowUpAt(
  reference = new Date(),
  minutesAhead = INBOUND_LEAD_FOLLOW_UP_MINUTES,
): string {
  const safeMinutes =
    Number.isFinite(minutesAhead) && minutesAhead > 0
      ? Math.min(24 * 60, Math.round(minutesAhead))
      : INBOUND_LEAD_FOLLOW_UP_MINUTES;
  return new Date(reference.getTime() + safeMinutes * 60_000).toISOString();
}
