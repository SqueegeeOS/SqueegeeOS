import "server-only";

import { normalizeEmailDestination } from "@/lib/communications/providers/contracts";
import { SQUEEGEEKING_TIERS } from "@/lib/membership/tier-config";
import {
  createPrivilegedServerSupabaseClient,
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import { buildStandardRepProfile, DAVID_REP_PROFILE } from "./rep-config";
import { normalizeNorthAmericanPhone } from "./workspace-validation";
import type {
  LeadIntakeSalesAssignment,
  LeadIntakeSalesRepOption,
} from "./lead-intake-assignment";

interface SalesRepRow {
  id: string;
  slug: string;
  display_name: string;
  role_title: string;
  status: "active" | "inactive";
}

interface LeadIntakeAssignmentRow {
  id: string;
  lead_intake_id: string;
  rep_id: string;
  status: LeadIntakeSalesAssignment["status"];
  source: LeadIntakeSalesAssignment["source"];
  next_follow_up_at: string;
  created_at: string;
  updated_at: string;
}

interface LeadIntakeSourceRow {
  id: string;
  name: string;
  phone: string;
  email: string;
  service_address: string;
  notes: string | null;
  membership_tier: keyof typeof SQUEEGEEKING_TIERS | null;
  estimated_visit_price: number | string | null;
  status: "new" | "contacted" | "scheduled" | "archived";
  source: LeadIntakeSalesAssignment["source"];
  sms_consent_status: "unknown" | "opted_in" | "opted_out" | null;
  sms_consent_recorded_at: string | null;
  sms_consent_disclosure_version: string | null;
  sms_consent_source_path: string | null;
}

const ASSIGNMENT_SELECT =
  "id, lead_intake_id, rep_id, status, source, next_follow_up_at, created_at, updated_at";
const REP_PAGE_SIZE = 200;
const ASSIGNMENT_CHUNK_SIZE = 100;

export class LeadIntakeAssignmentError extends Error {
  readonly status: number;

  constructor(message: string, status = 409) {
    super(message);
    this.name = "LeadIntakeAssignmentError";
    this.status = status;
  }
}

function ensureStorage() {
  if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
    throw new LeadIntakeAssignmentError(
      "The private sales assignment ledger is not connected.",
      503,
    );
  }
}

function repOption(row: SalesRepRow): LeadIntakeSalesRepOption {
  const workspacePath =
    row.slug === DAVID_REP_PROFILE.slug
      ? DAVID_REP_PROFILE.workspacePath
      : buildStandardRepProfile({
          slug: row.slug,
          displayName: row.display_name,
          roleTitle: row.role_title,
        }).workspacePath;
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    roleTitle: row.role_title,
    workspacePath,
  };
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function loadRepRowsByIds(repIds: string[]): Promise<SalesRepRow[]> {
  if (repIds.length === 0) return [];
  const supabase = createPrivilegedServerSupabaseClient();
  const result = await supabase
    .from("sales_reps")
    .select("id, slug, display_name, role_title, status")
    .in("id", [...new Set(repIds)]);
  if (result.error) {
    throw new LeadIntakeAssignmentError(
      "HomeAtlas could not verify the assigned salesperson.",
      503,
    );
  }
  return (result.data ?? []) as SalesRepRow[];
}

function assignmentFromRows(
  row: LeadIntakeAssignmentRow,
  rep: SalesRepRow,
): LeadIntakeSalesAssignment {
  const option = repOption(rep);
  return {
    salesRepLeadId: row.id,
    leadIntakeId: row.lead_intake_id,
    repId: row.rep_id,
    repSlug: option.slug,
    repDisplayName: option.displayName,
    repWorkspacePath: option.workspacePath,
    status: row.status,
    source: row.source,
    nextFollowUpAt: row.next_follow_up_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadActiveLeadAssignmentReps(): Promise<
  LeadIntakeSalesRepOption[]
> {
  ensureStorage();
  const supabase = createPrivilegedServerSupabaseClient();
  const rows: SalesRepRow[] = [];
  let offset = 0;

  while (true) {
    const result = await supabase
      .from("sales_reps")
      .select("id, slug, display_name, role_title, status", { count: "exact" })
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + REP_PAGE_SIZE - 1);
    if (result.error || result.count === null) {
      throw new LeadIntakeAssignmentError(
        "HomeAtlas could not prove the active sales roster.",
        503,
      );
    }
    const page = (result.data ?? []) as SalesRepRow[];
    rows.push(...page);
    offset += page.length;
    if (offset >= result.count) return rows.map(repOption);
    if (page.length === 0) {
      throw new LeadIntakeAssignmentError(
        "HomeAtlas could not finish loading the active sales roster.",
        503,
      );
    }
  }
}

export async function loadLeadIntakeSalesAssignments(
  leadIntakeIds: string[],
): Promise<LeadIntakeSalesAssignment[]> {
  ensureStorage();
  const ids = [...new Set(leadIntakeIds.filter(Boolean))];
  if (ids.length === 0) return [];
  const supabase = createPrivilegedServerSupabaseClient();
  const rows: LeadIntakeAssignmentRow[] = [];

  for (const idChunk of chunks(ids, ASSIGNMENT_CHUNK_SIZE)) {
    const result = await supabase
      .from("sales_rep_leads")
      .select(ASSIGNMENT_SELECT, { count: "exact" })
      .in("lead_intake_id", idChunk);
    if (
      result.error ||
      result.count === null ||
      (result.data ?? []).length !== result.count
    ) {
      throw new LeadIntakeAssignmentError(
        "HomeAtlas could not load request ownership.",
        503,
      );
    }
    rows.push(...((result.data ?? []) as LeadIntakeAssignmentRow[]));
  }

  const reps = await loadRepRowsByIds(rows.map((row) => row.rep_id));
  const repsById = new Map(reps.map((rep) => [rep.id, rep]));
  return rows.map((row) => {
    const rep = repsById.get(row.rep_id);
    if (!rep) {
      throw new LeadIntakeAssignmentError(
        "A request assignment references a missing salesperson.",
        503,
      );
    }
    return assignmentFromRows(row, rep);
  });
}

export async function loadLeadIntakeSalesAssignment(
  leadIntakeId: string,
): Promise<LeadIntakeSalesAssignment | null> {
  const assignments = await loadLeadIntakeSalesAssignments([leadIntakeId]);
  if (assignments.length > 1) {
    throw new LeadIntakeAssignmentError(
      "This request has conflicting sales owners.",
      503,
    );
  }
  return assignments[0] ?? null;
}

function estimatedArrCents(intake: LeadIntakeSourceRow): number {
  const visitPrice = Number(intake.estimated_visit_price);
  if (!Number.isFinite(visitPrice) || visitPrice <= 0 || !intake.membership_tier) {
    return 0;
  }
  const tier = SQUEEGEEKING_TIERS[intake.membership_tier];
  return tier
    ? Math.min(100_000_000, Math.round(visitPrice * tier.visitsPerYear * 100))
    : 0;
}

function preservedSmsConsent(intake: LeadIntakeSourceRow): {
  status: "unknown" | "opted_in" | "opted_out";
  recordedAt: string | null;
  disclosureVersion: string | null;
  sourcePath: string | null;
} {
  if (
    (intake.sms_consent_status === "opted_in" ||
      intake.sms_consent_status === "opted_out") &&
    intake.sms_consent_recorded_at
  ) {
    return {
      status: intake.sms_consent_status,
      recordedAt: intake.sms_consent_recorded_at,
      disclosureVersion: intake.sms_consent_disclosure_version,
      sourcePath: intake.sms_consent_source_path,
    };
  }
  return {
    status: "unknown",
    recordedAt: null,
    disclosureVersion: null,
    sourcePath: null,
  };
}

export async function assignLeadIntakeToSalesRep(input: {
  leadIntakeId: string;
  repSlug: string;
  nextFollowUpAt: string;
}): Promise<LeadIntakeSalesAssignment> {
  ensureStorage();
  const supabase = createPrivilegedServerSupabaseClient();
  const [intakeResult, repResult, existing] = await Promise.all([
    supabase
      .from("lead_intakes")
      .select(
        "id, name, phone, email, service_address, notes, membership_tier, estimated_visit_price, status, source, sms_consent_status, sms_consent_recorded_at, sms_consent_disclosure_version, sms_consent_source_path",
      )
      .eq("id", input.leadIntakeId)
      .maybeSingle(),
    supabase
      .from("sales_reps")
      .select("id, slug, display_name, role_title, status")
      .eq("slug", input.repSlug)
      .eq("status", "active")
      .maybeSingle(),
    loadLeadIntakeSalesAssignment(input.leadIntakeId),
  ]);
  if (intakeResult.error || !intakeResult.data) {
    throw new LeadIntakeAssignmentError("Customer request was not found.", 404);
  }
  if (repResult.error || !repResult.data) {
    throw new LeadIntakeAssignmentError(
      "Choose an active salesperson.",
      400,
    );
  }
  const intake = intakeResult.data as LeadIntakeSourceRow;
  const rep = repResult.data as SalesRepRow;
  if (intake.status === "archived") {
    throw new LeadIntakeAssignmentError(
      "Restore this archived request before assigning it.",
      409,
    );
  }

  if (existing) {
    if (existing.repId !== rep.id) {
      throw new LeadIntakeAssignmentError(
        `${existing.repDisplayName} already owns this request.`,
        409,
      );
    }
    const update = await supabase
      .from("sales_rep_leads")
      .update({ next_follow_up_at: input.nextFollowUpAt })
      .eq("id", existing.salesRepLeadId)
      .eq("rep_id", rep.id)
      .select(ASSIGNMENT_SELECT)
      .maybeSingle();
    if (update.error || !update.data) {
      throw new LeadIntakeAssignmentError(
        "HomeAtlas could not update the next action.",
        503,
      );
    }
    return assignmentFromRows(update.data as LeadIntakeAssignmentRow, rep);
  }

  const phone = normalizeNorthAmericanPhone(intake.phone);
  const email = normalizeEmailDestination(intake.email);
  if (!phone && !email) {
    throw new LeadIntakeAssignmentError(
      "This request needs a valid phone or email before assignment.",
      409,
    );
  }
  const sms = preservedSmsConsent(intake);
  const insert = await supabase
    .from("sales_rep_leads")
    .insert({
      rep_id: rep.id,
      lead_intake_id: intake.id,
      full_name: intake.name,
      property_address: intake.service_address,
      phone_normalized: phone,
      email_normalized: email,
      status: "follow_up",
      source: intake.source,
      estimated_arr_cents: estimatedArrCents(intake),
      next_follow_up_at: input.nextFollowUpAt,
      notes: intake.notes?.trim() || null,
      sms_consent_status: sms.status,
      sms_consent_recorded_at: sms.recordedAt,
      sms_consent_disclosure_version: sms.disclosureVersion,
      sms_consent_source_path: sms.sourcePath,
      email_consent_status: "unknown",
      email_consent_recorded_at: null,
    })
    .select(ASSIGNMENT_SELECT)
    .maybeSingle();
  if (insert.error?.code === "23505") {
    const raced = await loadLeadIntakeSalesAssignment(intake.id);
    if (raced?.repId === rep.id) return raced;
    if (raced) {
      throw new LeadIntakeAssignmentError(
        `${raced.repDisplayName} already owns this request.`,
        409,
      );
    }
  }
  if (insert.error || !insert.data) {
    throw new LeadIntakeAssignmentError(
      insert.error?.message.includes("lead_intake_id")
        ? "Apply the request-assignment database migration before assigning leads."
        : "HomeAtlas could not save request ownership.",
      503,
    );
  }
  return assignmentFromRows(insert.data as LeadIntakeAssignmentRow, rep);
}
