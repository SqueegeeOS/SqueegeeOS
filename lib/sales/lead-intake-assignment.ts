import type { SalesLeadSource, SalesLeadStatus } from "./workspace-types";

export interface LeadIntakeSalesRepOption {
  id: string;
  slug: string;
  displayName: string;
  roleTitle: string;
  workspacePath: string;
}

export interface LeadIntakeSalesAssignment {
  salesRepLeadId: string;
  leadIntakeId: string;
  repId: string;
  repSlug: string;
  repDisplayName: string;
  repWorkspacePath: string;
  status: SalesLeadStatus;
  source: Extract<SalesLeadSource, "request_form" | "facebook_lead_ad">;
  nextFollowUpAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssignLeadIntakeInput {
  repSlug: string;
  nextFollowUpAt: string;
}

const REP_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SALES_REP_LEAD_ANCHOR_PREFIX = "sales-lead-";

export function salesRepLeadAnchorId(salesRepLeadId: string): string {
  return `${SALES_REP_LEAD_ANCHOR_PREFIX}${salesRepLeadId}`;
}

export function salesRepLeadWorkspaceHref(
  workspacePath: string,
  salesRepLeadId: string,
): string {
  return `${workspacePath}#${salesRepLeadAnchorId(salesRepLeadId)}`;
}

export function salesRepLeadIdFromHash(hash: string): string | null {
  const value = hash.startsWith("#") ? hash.slice(1) : hash;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (!decoded.startsWith(SALES_REP_LEAD_ANCHOR_PREFIX)) return null;
  return decoded.slice(SALES_REP_LEAD_ANCHOR_PREFIX.length).trim() || null;
}

export function validateLeadIntakeAssignment(
  input: unknown,
  reference = new Date(),
):
  | { ok: true; value: AssignLeadIntakeInput }
  | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Choose an owner and a next action." };
  }

  const raw = input as Record<string, unknown>;
  const repSlug =
    typeof raw.repSlug === "string" ? raw.repSlug.trim().toLowerCase() : "";
  if (!REP_SLUG_PATTERN.test(repSlug) || repSlug.length > 80) {
    return { ok: false, error: "Choose an active salesperson." };
  }

  const parsed = new Date(
    typeof raw.nextFollowUpAt === "string" ? raw.nextFollowUpAt : "",
  );
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, error: "Choose a valid next-action time." };
  }
  if (parsed.getTime() <= reference.getTime()) {
    return { ok: false, error: "The next action must be in the future." };
  }
  if (parsed.getTime() > reference.getTime() + 366 * 24 * 60 * 60 * 1000) {
    return { ok: false, error: "Choose a next action within one year." };
  }

  return {
    ok: true,
    value: { repSlug, nextFollowUpAt: parsed.toISOString() },
  };
}

export function salesLeadSourceLabel(source: SalesLeadSource): string {
  switch (source) {
    case "request_form":
      return "Website request";
    case "facebook_lead_ad":
      return "Facebook lead";
    case "door_to_door":
      return "Door-to-door";
    case "referral":
      return "Referral";
    case "event":
      return "Event";
    default:
      return "Manual lead";
  }
}
