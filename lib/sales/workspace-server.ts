import "server-only";

import {
  buildStandardRepProfile,
  DAVID_REP_PROFILE,
  type SalesRepProfile,
} from "./rep-config";
import type {
  CreateSalesLeadInput,
  SalesActivityReceipt,
  SalesActivityReversalReceipt,
  SalesActivityType,
  SalesDoorMemory,
  SalesDoorMemoryReceipt,
  SalesLeadAttentionSnapshot,
  SalesLeadSource,
  SalesLeadStatus,
  SalesRepLead,
  SalesRepRecentWin,
  SalesWorkspacePayload,
} from "./workspace-types";
import type { SalesDoorDisposition } from "./door-memory";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getSalesActivityUndoExpiresAt,
  isReversibleSalesActivityType,
  isSalesActivityUndoAvailable,
} from "./activity-reversal";
import { getBusinessCalendarDayUtcBounds } from "@/lib/admin/company-business-timezone";
import {
  createPrivilegedServerSupabaseClient,
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import { reconcileSignedMembershipAttributionsForRep } from "./signed-attribution-server";
import {
  buildSalesRepRecentWins,
  selectRecentSalesRepWinSources,
  type SalesRepWinAttributionSource,
  type SalesRepWinLeadIdentity,
  type SalesRepWinPresentationIdentity,
} from "./recent-wins";
import {
  loadSalesProductionHandoffSnapshotForAttributions,
  type SalesProductionHandoffAttributionSource,
} from "./production-handoff-server";
import type {
  SalesProductionHandoffRecord,
  SalesProductionHandoffSnapshot,
} from "./production-handoff";
import {
  salesRepLaunchCountsEvidenceFromRow,
  type SalesRepLaunchEvidenceRow,
  unavailableSalesRepLaunchCountsEvidence,
} from "./rep-launch-readiness";

interface SalesRepRow {
  id: string;
  slug: string;
  display_name: string;
  role_title: string;
  compensation_plan: "founding_david" | "standard_commission";
}

export interface ActiveSalesRepIdentity {
  id: string;
  slug: string;
  displayName: string;
  compensationPlan: "founding_david" | "standard_commission";
}

export interface PresentationSalesLeadPrefill {
  id: string;
  leadIntakeId: string | null;
  fullName: string;
  propertyAddress: string;
  phone: string | null;
  email: string | null;
}

interface SalesLeadRow {
  id: string;
  lead_intake_id: string | null;
  full_name: string;
  property_address: string;
  phone_normalized: string | null;
  email_normalized: string | null;
  status: SalesLeadStatus;
  source: SalesLeadSource;
  estimated_arr_cents: number;
  next_follow_up_at: string | null;
  notes: string | null;
  sms_consent_status: "unknown" | "opted_in" | "opted_out";
  email_consent_status: "unknown" | "opted_in" | "opted_out";
  created_at: string;
  updated_at: string;
}

interface SalesActivityRow {
  event_type: string;
  quantity: number;
}

interface SalesDoorMemoryRow {
  id: string;
  door_activity_id: string;
  lead_id: string | null;
  client_event_id: string;
  property_address: string;
  address_key: string;
  disposition: SalesDoorDisposition;
  notes: string | null;
  occurred_at: string;
}

interface CreatedSalesActivityRow {
  id: string;
  event_type: SalesActivityType;
  quantity: number;
  occurred_at: string;
  lead_id: string | null;
  client_event_id: string | null;
}

interface ReversibleSalesActivityRow extends CreatedSalesActivityRow {
  lead_id: string | null;
  reversed_at: string | null;
}

interface SalesAttributionRow {
  id: string;
  lead_id: string | null;
  presentation_id: string | null;
  membership_id: string | null;
  signed_agreement_id: string | null;
  qualification_status: "pending" | "active" | "qualified" | "cancelled";
  attributed_arr_cents: number;
  attributed_at: string;
}

const SALES_LEAD_SELECT =
  "id, lead_intake_id, full_name, property_address, phone_normalized, email_normalized, status, source, estimated_arr_cents, next_follow_up_at, notes, sms_consent_status, email_consent_status, created_at, updated_at";
const OPEN_SALES_LEAD_STATUSES: SalesLeadStatus[] = [
  "new",
  "follow_up",
  "presentation",
  "considering",
];
const SALES_LEAD_PAGE_SIZE = 500;
const SALES_ATTRIBUTION_SELECT =
  "id, lead_id, presentation_id, membership_id, signed_agreement_id, qualification_status, attributed_arr_cents, attributed_at";
const SALES_ATTRIBUTION_PAGE_SIZE = 500;
const RECENT_DOOR_MEMORY_LIMIT = 20;
const SALES_DOOR_MEMORY_SELECT =
  "id, door_activity_id, lead_id, client_event_id, property_address, address_key, disposition, notes, occurred_at";

export class SalesWorkspaceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SalesWorkspaceUnavailableError";
  }
}

export class SalesWorkspaceActionError extends Error {
  readonly status: number;

  constructor(message: string, status = 409) {
    super(message);
    this.name = "SalesWorkspaceActionError";
    this.status = status;
  }
}

function ensureSalesStorage() {
  if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
    throw new SalesWorkspaceUnavailableError(
      "The private sales workspace is not connected to durable storage.",
    );
  }
}

function readableStorageError(message: string): string {
  if (
    message.includes("sales_reps") ||
    message.includes("sales_rep_leads") ||
    message.includes("sales_rep_door_visits") ||
    message.includes("sales_rep_attributions") ||
    message.includes("reversed_at") ||
    message.includes("client_event_id") ||
    message.includes("PGRST204") ||
    message.includes("PGRST205")
  ) {
    return "The sales workspace database upgrade has not been applied yet.";
  }
  return "The private sales workspace could not be loaded.";
}

function profileFromRow(row: SalesRepRow): SalesRepProfile {
  if (
    row.slug === DAVID_REP_PROFILE.slug &&
    row.compensation_plan === "founding_david"
  ) {
    return DAVID_REP_PROFILE;
  }

  return buildStandardRepProfile({
    slug: row.slug,
    displayName: row.display_name,
    roleTitle: row.role_title,
  });
}

function leadFromRow(row: SalesLeadRow): SalesRepLead {
  return {
    id: row.id,
    leadIntakeId: row.lead_intake_id,
    fullName: row.full_name,
    propertyAddress: row.property_address,
    phone: row.phone_normalized,
    email: row.email_normalized,
    status: row.status,
    source: row.source,
    estimatedArrCents: Number(row.estimated_arr_cents) || 0,
    nextFollowUpAt: row.next_follow_up_at,
    notes: row.notes ?? "",
    smsConsentStatus: row.sms_consent_status,
    emailConsentStatus: row.email_consent_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function doorMemoryFromRow(row: SalesDoorMemoryRow): SalesDoorMemory {
  return {
    id: row.id,
    leadId: row.lead_id,
    propertyAddress: row.property_address,
    disposition: row.disposition,
    notes: row.notes ?? "",
    occurredAt: row.occurred_at,
  };
}

async function loadRecentDoorMemories(repId: string): Promise<{
  memories: SalesDoorMemory[];
  status: SalesWorkspacePayload["recentDoorMemoriesStatus"];
}> {
  const supabase = createPrivilegedServerSupabaseClient();
  const result = await supabase
    .from("sales_rep_door_visits")
    .select(SALES_DOOR_MEMORY_SELECT)
    .eq("rep_id", repId)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(RECENT_DOOR_MEMORY_LIMIT);

  if (result.error) {
    console.error("[sales-workspace] recent door memory load failed", {
      repId,
      reason: result.error.message,
    });
    return { memories: [], status: "unavailable" };
  }

  return {
    memories: ((result.data ?? []) as SalesDoorMemoryRow[]).map(doorMemoryFromRow),
    status: "complete",
  };
}

export async function loadSalesDoorAddressHistory(
  slug: string,
  addressKey: string,
): Promise<SalesDoorMemory[]> {
  const rep = await loadRepRow(slug);
  const supabase = createPrivilegedServerSupabaseClient();
  const result = await supabase
    .from("sales_rep_door_visits")
    .select(SALES_DOOR_MEMORY_SELECT)
    .eq("rep_id", rep.id)
    .eq("address_key", addressKey)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(10);

  if (result.error) {
    throw new SalesWorkspaceUnavailableError(
      readableStorageError(result.error.message),
    );
  }
  return ((result.data ?? []) as SalesDoorMemoryRow[]).map(doorMemoryFromRow);
}

async function loadAllSalesRepAttributionRows(
  repId: string,
): Promise<SalesAttributionRow[]> {
  const supabase = createPrivilegedServerSupabaseClient();
  const rows: SalesAttributionRow[] = [];
  let offset = 0;

  while (true) {
    const result = await supabase
      .from("sales_rep_attributions")
      .select(SALES_ATTRIBUTION_SELECT, { count: "exact" })
      .eq("rep_id", repId)
      .order("attributed_at", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + SALES_ATTRIBUTION_PAGE_SIZE - 1);

    if (result.error) {
      throw new SalesWorkspaceUnavailableError(
        readableStorageError(result.error.message),
      );
    }
    if (result.count === null) {
      throw new SalesWorkspaceUnavailableError(
        "HomeAtlas could not prove that the signed-close ledger was complete.",
      );
    }

    const page = (result.data ?? []) as SalesAttributionRow[];
    rows.push(...page);
    offset += page.length;
    if (offset >= result.count) return rows;
    if (page.length === 0) {
      throw new SalesWorkspaceUnavailableError(
        "HomeAtlas could not finish loading the signed-close ledger.",
      );
    }
  }
}

async function loadRecentWinLeadIdentities(
  supabase: SupabaseClient,
  repId: string,
  ids: string[],
): Promise<SalesRepWinLeadIdentity[]> {
  if (ids.length === 0) return [];
  const result = await supabase
    .from("sales_rep_leads")
    .select("id, full_name, property_address")
    .eq("rep_id", repId)
    .in("id", ids);
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []).map((row) => ({
    id: String(row.id),
    fullName: String(row.full_name ?? ""),
    propertyAddress: String(row.property_address ?? ""),
  }));
}

async function loadRecentWinPresentationIdentities(
  supabase: SupabaseClient,
  repId: string,
  ids: string[],
): Promise<SalesRepWinPresentationIdentity[]> {
  if (ids.length === 0) return [];
  const result = await supabase
    .from("presentations")
    .select("id, client_name, client_address")
    .eq("sales_rep_id", repId)
    .in("id", ids);
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []).map((row) => ({
    id: String(row.id),
    clientName: String(row.client_name ?? ""),
    clientAddress: String(row.client_address ?? ""),
  }));
}

async function loadRecentSalesRepWins(
  repId: string,
  attributions: SalesAttributionRow[],
  referenceDate: Date,
): Promise<{
  wins: SalesRepRecentWin[];
  productionHandoffStatus: SalesWorkspacePayload["productionHandoffStatus"];
}> {
  const recentSources = selectRecentSalesRepWinSources(
    attributions.map(
      (attribution): SalesRepWinAttributionSource => ({
        id: attribution.id,
        membershipId: attribution.membership_id,
        leadId: attribution.lead_id,
        presentationId: attribution.presentation_id,
        attributedArrCents: Number(attribution.attributed_arr_cents) || 0,
        status: attribution.qualification_status,
        attributedAt: attribution.attributed_at,
      }),
    ),
    6,
  );
  const leadIds = [
    ...new Set(
      recentSources
        .map((attribution) => attribution.leadId)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const presentationIds = [
    ...new Set(
      recentSources
        .map((attribution) => attribution.presentationId)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const supabase = createPrivilegedServerSupabaseClient();
  const [leads, presentations] = await Promise.all([
    loadRecentWinLeadIdentities(supabase, repId, leadIds),
    loadRecentWinPresentationIdentities(supabase, repId, presentationIds),
  ]);
  let productionHandoffs: SalesProductionHandoffSnapshot["records"] = [];
  let productionHandoffStatus: SalesWorkspacePayload["productionHandoffStatus"] =
    "complete";
  try {
    const signedAgreementByAttribution = new Map(
      attributions.map((attribution) => [
        attribution.id,
        attribution.signed_agreement_id,
      ]),
    );
    productionHandoffs = (
      await loadSalesProductionHandoffSnapshotForAttributions(
        recentSources.flatMap((attribution) => {
          const signedAgreementId = signedAgreementByAttribution.get(
            attribution.id,
          );
          return signedAgreementId
            ? [
                {
                  id: attribution.id,
                  membershipId: attribution.membershipId,
                  signedAgreementId,
                  qualificationStatus: attribution.status,
                  attributedArrCents: attribution.attributedArrCents,
                  attributedAt: attribution.attributedAt,
                } satisfies SalesProductionHandoffAttributionSource,
              ]
            : [];
        }),
        referenceDate,
      )
    ).records;
  } catch (error) {
    productionHandoffStatus = "unavailable";
    console.error("[sales-workspace] production handoff load failed", error);
  }
  return {
    wins: buildSalesRepRecentWins({
      attributions: recentSources,
      leads,
      presentations,
      productionHandoffs,
    }),
    productionHandoffStatus,
  };
}

async function loadAllOpenSalesRepLeadRows(
  repId: string,
): Promise<SalesLeadRow[]> {
  const supabase = createPrivilegedServerSupabaseClient();
  const rows: SalesLeadRow[] = [];
  let offset = 0;

  while (true) {
    const result = await supabase
      .from("sales_rep_leads")
      .select(SALES_LEAD_SELECT, { count: "exact" })
      .eq("rep_id", repId)
      .in("status", OPEN_SALES_LEAD_STATUSES)
      .order("next_follow_up_at", { ascending: true, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + SALES_LEAD_PAGE_SIZE - 1);

    if (result.error) {
      throw new SalesWorkspaceUnavailableError(
        readableStorageError(result.error.message),
      );
    }
    if (result.count === null) {
      throw new SalesWorkspaceUnavailableError(
        "HomeAtlas could not prove that the active lead queue was complete.",
      );
    }

    const page = (result.data ?? []) as SalesLeadRow[];
    rows.push(...page);
    offset += page.length;
    if (offset >= result.count) return rows;
    if (page.length === 0) {
      throw new SalesWorkspaceUnavailableError(
        "HomeAtlas could not finish loading the active lead queue.",
      );
    }
  }
}

async function loadRepRow(slug: string): Promise<SalesRepRow> {
  ensureSalesStorage();
  const supabase = createPrivilegedServerSupabaseClient();
  const { data, error } = await supabase
    .from("sales_reps")
    .select("id, slug, display_name, role_title, compensation_plan")
    .eq("slug", slug.trim().toLowerCase())
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new SalesWorkspaceUnavailableError(readableStorageError(error.message));
  }
  if (!data) {
    throw new SalesWorkspaceUnavailableError("That sales workspace is not active.");
  }
  return data as SalesRepRow;
}

export async function loadSalesRepProfile(slug: string): Promise<SalesRepProfile> {
  return profileFromRow(await loadRepRow(slug));
}

export async function loadActiveSalesRepIdentity(
  slug: string,
): Promise<ActiveSalesRepIdentity> {
  const rep = await loadRepRow(slug);
  return {
    id: rep.id,
    slug: rep.slug,
    displayName: rep.display_name,
    compensationPlan: rep.compensation_plan,
  };
}

export async function resolvePresentationSalesLineage(
  slug: string,
  leadId: string | null,
): Promise<
  ActiveSalesRepIdentity & {
    leadId: string | null;
    lead: PresentationSalesLeadPrefill | null;
  }
> {
  const rep = await loadRepRow(slug);
  let leadPrefill: PresentationSalesLeadPrefill | null = null;
  if (leadId) {
    const supabase = createPrivilegedServerSupabaseClient();
    const { data, error } = await supabase
      .from("sales_rep_leads")
      .select("id, lead_intake_id, full_name, property_address, phone_normalized, email_normalized")
      .eq("id", leadId)
      .eq("rep_id", rep.id)
      .maybeSingle();
    if (error || !data) {
      throw new SalesWorkspaceActionError(
        "That lead does not belong to this sales workspace.",
        400,
      );
    }
    leadPrefill = {
      id: String(data.id),
      leadIntakeId:
        typeof data.lead_intake_id === "string" ? data.lead_intake_id : null,
      fullName: String(data.full_name),
      propertyAddress: String(data.property_address),
      phone:
        typeof data.phone_normalized === "string"
          ? data.phone_normalized
          : null,
      email:
        typeof data.email_normalized === "string"
          ? data.email_normalized
          : null,
    };
  }

  return {
    id: rep.id,
    slug: rep.slug,
    displayName: rep.display_name,
    compensationPlan: rep.compensation_plan,
    leadId,
    lead: leadPrefill,
  };
}

export async function loadSalesWorkspace(
  slug: string,
  referenceDate = new Date(),
): Promise<SalesWorkspacePayload> {
  const rep = await loadRepRow(slug);
  const supabase = createPrivilegedServerSupabaseClient();
  const { startUtc, endUtc } = getBusinessCalendarDayUtcBounds(referenceDate);

  let closeLedgerStatus: SalesWorkspacePayload["closeLedgerStatus"] = "complete";
  try {
    const reconciliation = await reconcileSignedMembershipAttributionsForRep(
      rep.id,
      5,
    );
    if (reconciliation.failed > 0 || reconciliation.remaining > 0) {
      closeLedgerStatus = "needs_attention";
      console.warn("[sales-workspace] signed-close repair still has gaps", {
        repId: rep.id,
        ...reconciliation,
      });
    }
  } catch (error) {
    closeLedgerStatus = "needs_attention";
    // Sales reporting repair must never make the field workspace unavailable.
    console.error("[sales-workspace] nonfatal attribution reconciliation failure", error);
  }

  const [
    openLeadRows,
    leadsTodayResult,
    activityResult,
    attributions,
    doorMemoryResult,
    launchEvidenceResult,
  ] =
    await Promise.all([
      loadAllOpenSalesRepLeadRows(rep.id),
      supabase
        .from("sales_rep_leads")
        .select("id", { count: "exact", head: true })
        .eq("rep_id", rep.id)
        .gte("created_at", startUtc.toISOString())
        .lt("created_at", endUtc.toISOString()),
      supabase
        .from("sales_rep_activity_events")
        .select("event_type, quantity")
        .eq("rep_id", rep.id)
        .is("reversed_at", null)
        .gte("occurred_at", startUtc.toISOString())
        .lt("occurred_at", endUtc.toISOString()),
      loadAllSalesRepAttributionRows(rep.id),
      loadRecentDoorMemories(rep.id),
      supabase.rpc("homeatlas_sales_rep_launch_evidence"),
    ]);

  const firstError = leadsTodayResult.error ?? activityResult.error;
  if (firstError) {
    throw new SalesWorkspaceUnavailableError(readableStorageError(firstError.message));
  }
  if (leadsTodayResult.count === null) {
    throw new SalesWorkspaceUnavailableError(
      "HomeAtlas could not verify today's lead count.",
    );
  }

  const leads = openLeadRows.map(leadFromRow);
  const activities = (activityResult.data ?? []) as SalesActivityRow[];
  const activityCount = (eventType: string) =>
    activities.reduce(
      (total, activity) =>
        total + (activity.event_type === eventType ? Number(activity.quantity) || 0 : 0),
      0,
    );
  const openLeads = leads;
  let launchEvidence = unavailableSalesRepLaunchCountsEvidence();
  if (!launchEvidenceResult.error) {
    const launchEvidenceRow = (
      (launchEvidenceResult.data ?? []) as SalesRepLaunchEvidenceRow[]
    ).find((row) => row.rep_id === rep.id);
    if (launchEvidenceRow) {
      launchEvidence =
        salesRepLaunchCountsEvidenceFromRow(launchEvidenceRow) ??
        unavailableSalesRepLaunchCountsEvidence();
    }
  } else {
    console.error(
      "[sales-workspace] nonfatal first-loop evidence load failed",
      launchEvidenceResult.error,
    );
  }
  const signatureBackedAttributions = attributions.filter(
    (attribution) => Boolean(attribution.signed_agreement_id),
  );
  const closedAttributions = signatureBackedAttributions.filter(
    (attribution) => attribution.qualification_status !== "cancelled",
  );
  const attributionsToday = closedAttributions.filter((attribution) => {
    const attributedAt = new Date(attribution.attributed_at);
    return attributedAt >= startUtc && attributedAt < endUtc;
  });
  let recentWins: SalesRepRecentWin[] = [];
  let recentWinsStatus: SalesWorkspacePayload["recentWinsStatus"] = "complete";
  let productionHandoffStatus: SalesWorkspacePayload["productionHandoffStatus"] =
    "complete";
  try {
    const recentWinResult = await loadRecentSalesRepWins(
      rep.id,
      signatureBackedAttributions,
      referenceDate,
    );
    recentWins = recentWinResult.wins;
    productionHandoffStatus = recentWinResult.productionHandoffStatus;
  } catch (error) {
    recentWinsStatus = "unavailable";
    productionHandoffStatus = "unavailable";
    console.error("[sales-workspace] recent signed-close identity load failed", error);
  }

  return {
    profile: profileFromRow(rep),
    launchEvidence,
    metrics: {
      doorsToday: activityCount("door_knock"),
      conversationsToday: activityCount("conversation"),
      presentationsToday: activityCount("presentation_started"),
      leadsToday: leadsTodayResult.count,
      signedToday: attributionsToday.length,
      closedArrTodayCents: attributionsToday.reduce(
        (total, attribution) =>
          total + (Number(attribution.attributed_arr_cents) || 0),
        0,
      ),
      closedArrCents: closedAttributions.reduce(
        (total, attribution) =>
          total + (Number(attribution.attributed_arr_cents) || 0),
        0,
      ),
      openPipelineCount: openLeads.length,
      pipelineArrCents: openLeads.reduce(
        (total, lead) => total + lead.estimatedArrCents,
        0,
      ),
      qualifiedRetainedMembers: closedAttributions.filter(
        (attribution) => attribution.qualification_status === "qualified",
      ).length,
    },
    leads,
    recentDoorMemories: doorMemoryResult.memories,
    recentDoorMemoriesStatus: doorMemoryResult.status,
    recentWins,
    recentWinsStatus,
    productionHandoffStatus,
    closeLedgerStatus,
    generatedAt: referenceDate.toISOString(),
  };
}

/**
 * Read-only owner view of every non-cancelled, signature-backed close and its
 * current production handoff. This never repairs attribution or mutates Jobber.
 */
export async function loadSalesProductionHandoffAttentionSnapshot(
  slug: string,
  referenceDate = new Date(),
): Promise<SalesProductionHandoffSnapshot> {
  const rep = await loadRepRow(slug);
  const attributions = await loadAllSalesRepAttributionRows(rep.id);
  return loadSalesProductionHandoffSnapshotForAttributions(
    attributions.flatMap((attribution) =>
      attribution.signed_agreement_id
        ? [
            {
              id: attribution.id,
              membershipId: attribution.membership_id,
              signedAgreementId: attribution.signed_agreement_id,
              qualificationStatus: attribution.qualification_status,
              attributedArrCents: Number(attribution.attributed_arr_cents) || 0,
              attributedAt: attribution.attributed_at,
            } satisfies SalesProductionHandoffAttributionSource,
          ]
        : [],
    ),
    referenceDate,
  );
}

export async function loadSalesProductionHandoffAttentionForRoster(
  reps: Array<{ id: string }>,
  referenceDate = new Date(),
): Promise<Array<{ repId: string; handoff: SalesProductionHandoffRecord }>> {
  const attributionRowsByRep = await Promise.all(
    reps.map(async (rep) => ({
      repId: rep.id,
      rows: await loadAllSalesRepAttributionRows(rep.id),
    })),
  );
  const repIdByAttributionId = new Map<string, string>();
  const sources = attributionRowsByRep.flatMap(({ repId, rows }) =>
    rows.flatMap((attribution): SalesProductionHandoffAttributionSource[] => {
      if (!attribution.signed_agreement_id) return [];
      repIdByAttributionId.set(attribution.id, repId);
      return [
        {
          id: attribution.id,
          membershipId: attribution.membership_id,
          signedAgreementId: attribution.signed_agreement_id,
          qualificationStatus: attribution.qualification_status,
          attributedArrCents: Number(attribution.attributed_arr_cents) || 0,
          attributedAt: attribution.attributed_at,
        },
      ];
    }),
  );
  const snapshot = await loadSalesProductionHandoffSnapshotForAttributions(
    sources,
    referenceDate,
  );

  return snapshot.records.map((handoff) => {
    const repId = repIdByAttributionId.get(handoff.attributionId);
    if (!repId) {
      throw new SalesWorkspaceUnavailableError(
        "HomeAtlas could not prove the owner of a signed handoff.",
      );
    }
    return { repId, handoff };
  });
}

/**
 * Read-only pipeline view for owner attention surfaces.
 * Unlike loadSalesWorkspace, this never runs attribution reconciliation.
 */
export async function loadSalesLeadAttentionSnapshot(
  slug: string,
  referenceDate = new Date(),
): Promise<SalesLeadAttentionSnapshot> {
  const rep = await loadRepRow(slug);
  const openLeadRows = await loadAllOpenSalesRepLeadRows(rep.id);
  return {
    profile: profileFromRow(rep),
    leads: openLeadRows.map(leadFromRow),
    generatedAt: referenceDate.toISOString(),
  };
}

export async function createSalesLead(
  slug: string,
  input: Required<Omit<CreateSalesLeadInput, "phone" | "email" | "nextFollowUpAt" | "notes" | "doorMemoryClientEventId">> & {
    phone: string | null;
    email: string | null;
    nextFollowUpAt: string | null;
    notes: string;
    doorMemoryClientEventId: string | null;
  },
): Promise<SalesRepLead> {
  const rep = await loadRepRow(slug);
  const supabase = createPrivilegedServerSupabaseClient();
  const consentRecordedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("sales_rep_leads")
    .insert({
      rep_id: rep.id,
      full_name: input.fullName,
      property_address: input.propertyAddress,
      phone_normalized: input.phone,
      email_normalized: input.email,
      status: input.nextFollowUpAt ? "follow_up" : "new",
      estimated_arr_cents: Math.round(input.estimatedArrDollars * 100),
      next_follow_up_at: input.nextFollowUpAt,
      notes: input.notes || null,
      sms_consent_status: input.smsConsentAttested ? "opted_in" : "unknown",
      sms_consent_recorded_at: input.smsConsentAttested
        ? consentRecordedAt
        : null,
      sms_consent_disclosure_version: input.smsConsentAttested
        ? "d2d-service-follow-up-v1"
        : null,
      sms_consent_source_path: input.smsConsentAttested
        ? profileFromRow(rep).workspacePath
        : null,
      email_consent_status: input.emailConsentAttested ? "opted_in" : "unknown",
      email_consent_recorded_at: input.emailConsentAttested
        ? consentRecordedAt
        : null,
      source: "door_to_door",
    })
    .select(
      SALES_LEAD_SELECT,
    )
    .single();

  if (error || !data) {
    throw new SalesWorkspaceUnavailableError(
      readableStorageError(error?.message ?? "Lead insert failed"),
    );
  }

  const lead = leadFromRow(data as SalesLeadRow);
  const { error: activityError } = await supabase
    .from("sales_rep_activity_events")
    .insert({
      rep_id: rep.id,
      lead_id: lead.id,
      event_type: "lead_captured",
      quantity: 1,
      source_path: profileFromRow(rep).workspacePath,
    });

  if (activityError) {
    console.error("[sales-workspace] lead activity insert failed", activityError.message);
  }

  if (input.doorMemoryClientEventId) {
    const { error: doorBindingError } = await supabase
      .from("sales_rep_door_visits")
      .update({ lead_id: lead.id })
      .eq("rep_id", rep.id)
      .eq("client_event_id", input.doorMemoryClientEventId)
      .is("lead_id", null);
    if (doorBindingError) {
      // The homeowner remains safely captured even if optional field-history
      // lineage needs repair; never invite a duplicate lead retry.
      console.error(
        "[sales-workspace] door memory lead binding failed",
        doorBindingError.message,
      );
    }
  }

  return lead;
}

export async function updateSalesLead(
  slug: string,
  input: {
    leadId: string;
    status: Extract<
      SalesLeadStatus,
      "new" | "follow_up" | "presentation" | "considering" | "lost"
    >;
    estimatedArrDollars: number;
    nextFollowUpAt: string | null;
    notes: string;
  },
): Promise<SalesRepLead> {
  const rep = await loadRepRow(slug);
  const supabase = createPrivilegedServerSupabaseClient();
  const existing = await supabase
    .from("sales_rep_leads")
    .select("id, status, next_follow_up_at, updated_at")
    .eq("id", input.leadId)
    .eq("rep_id", rep.id)
    .maybeSingle();

  if (existing.error) {
    throw new SalesWorkspaceUnavailableError(
      readableStorageError(existing.error.message),
    );
  }
  if (!existing.data) {
    throw new SalesWorkspaceActionError(
      "That homeowner is not in this field workspace.",
      404,
    );
  }
  if (["signed", "won"].includes(String(existing.data.status))) {
    throw new SalesWorkspaceActionError(
      "That customer already has a completed sales outcome.",
    );
  }

  const { data, error } = await supabase
    .from("sales_rep_leads")
    .update({
      status: input.status,
      estimated_arr_cents: Math.round(input.estimatedArrDollars * 100),
      next_follow_up_at: input.nextFollowUpAt,
      notes: input.notes || null,
    })
    .eq("id", input.leadId)
    .eq("rep_id", rep.id)
    .eq("updated_at", String(existing.data.updated_at))
    .select(
      SALES_LEAD_SELECT,
    )
    .maybeSingle();

  if (error) {
    throw new SalesWorkspaceUnavailableError(readableStorageError(error.message));
  }
  if (!data) {
    throw new SalesWorkspaceActionError(
      "That homeowner changed in another session. Refresh and try again.",
    );
  }

  const followUpChanged =
    input.nextFollowUpAt !== null &&
    new Date(input.nextFollowUpAt).getTime() !==
      new Date(String(existing.data.next_follow_up_at ?? 0)).getTime();
  if (followUpChanged) {
    const { error: activityError } = await supabase
      .from("sales_rep_activity_events")
      .insert({
        rep_id: rep.id,
        lead_id: input.leadId,
        event_type: "follow_up_scheduled",
        quantity: 1,
        source_path: profileFromRow(rep).workspacePath,
      });
    if (activityError) {
      console.error(
        "[sales-workspace] follow-up activity insert failed",
        activityError.message,
      );
    }
  }

  return leadFromRow(data as SalesLeadRow);
}

/**
 * Creating a presentation advances its linked lead without manufacturing a
 * signed result or inflating the manual field-pitch counter.
 */
export async function markSalesLeadPresentationCreated(input: {
  repId: string;
  leadId: string;
}): Promise<void> {
  const supabase = createPrivilegedServerSupabaseClient();
  const { error } = await supabase
    .from("sales_rep_leads")
    .update({ status: "presentation" })
    .eq("id", input.leadId)
    .eq("rep_id", input.repId)
    .in("status", ["new", "follow_up", "presentation", "considering"]);
  if (error) {
    throw new SalesWorkspaceUnavailableError(readableStorageError(error.message));
  }
}

export async function createSalesActivity(
  slug: string,
  input: {
    activityType: SalesActivityType;
    quantity: number;
    leadId: string | null;
    clientEventId: string | null;
    occurredAt: string | null;
  },
): Promise<SalesActivityReceipt> {
  const rep = await loadRepRow(slug);
  const supabase = createPrivilegedServerSupabaseClient();

  if (input.leadId) {
    const { data: lead, error: leadError } = await supabase
      .from("sales_rep_leads")
      .select("id")
      .eq("id", input.leadId)
      .eq("rep_id", rep.id)
      .maybeSingle();
    if (leadError || !lead) {
      throw new SalesWorkspaceUnavailableError("That lead does not belong to this workspace.");
    }
  }

  const activityPayload = {
    rep_id: rep.id,
    lead_id: input.leadId,
    event_type: input.activityType,
    quantity: input.quantity,
    source_path: profileFromRow(rep).workspacePath,
    client_event_id: input.clientEventId,
    ...(input.occurredAt ? { occurred_at: input.occurredAt } : {}),
  };
  const activityQuery = input.clientEventId
    ? supabase.from("sales_rep_activity_events").upsert(activityPayload, {
        onConflict: "rep_id,client_event_id",
        ignoreDuplicates: true,
      })
    : supabase.from("sales_rep_activity_events").insert(activityPayload);
  const inserted = await activityQuery
    .select("id, event_type, quantity, occurred_at, lead_id, client_event_id")
    .maybeSingle();

  if (inserted.error) {
    throw new SalesWorkspaceUnavailableError(
      readableStorageError(inserted.error.message),
    );
  }

  const existing =
    !inserted.data && input.clientEventId
      ? await supabase
          .from("sales_rep_activity_events")
          .select(
            "id, event_type, quantity, occurred_at, lead_id, client_event_id",
          )
          .eq("rep_id", rep.id)
          .eq("client_event_id", input.clientEventId)
          .maybeSingle()
      : inserted;

  if (existing.error || !existing.data) {
    throw new SalesWorkspaceUnavailableError(
      readableStorageError(existing.error?.message ?? "Activity insert failed"),
    );
  }

  const activity = existing.data as CreatedSalesActivityRow;
  if (
    activity.event_type !== input.activityType ||
    Number(activity.quantity) !== input.quantity ||
    activity.lead_id !== input.leadId ||
    (input.occurredAt !== null &&
      new Date(activity.occurred_at).getTime() !==
        new Date(input.occurredAt).getTime())
  ) {
    throw new SalesWorkspaceActionError(
      "That field retry reference was already used for a different activity.",
    );
  }
  const undoExpiresAt =
    input.leadId === null && isReversibleSalesActivityType(activity.event_type)
      ? getSalesActivityUndoExpiresAt(activity.occurred_at)
      : null;

  return {
    id: activity.id,
    activityType: activity.event_type,
    quantity: Number(activity.quantity) || input.quantity,
    occurredAt: activity.occurred_at,
    undoExpiresAt,
  };
}

function assertDoorMemoryRetryMatches(
  row: SalesDoorMemoryRow,
  expected: {
    doorActivityId: string;
    propertyAddress: string;
    addressKey: string;
    disposition: SalesDoorDisposition;
    notes: string;
    leadId: string | null;
  },
) {
  if (
    row.door_activity_id !== expected.doorActivityId ||
    row.property_address !== expected.propertyAddress ||
    row.address_key !== expected.addressKey ||
    row.disposition !== expected.disposition ||
    (row.notes ?? "") !== expected.notes ||
    row.lead_id !== expected.leadId
  ) {
    throw new SalesWorkspaceActionError(
      "That door retry reference was already used for different details.",
      409,
    );
  }
}

function doorMemoryReceiptFromRow(row: SalesDoorMemoryRow): SalesDoorMemoryReceipt {
  return {
    ...doorMemoryFromRow(row),
    doorActivityId: row.door_activity_id,
  };
}

export async function createSalesDoorMemory(
  slug: string,
  input: {
    doorActivityClientEventId: string;
    clientEventId: string;
    propertyAddress: string;
    addressKey: string;
    disposition: SalesDoorDisposition;
    notes: string;
    leadId: string | null;
  },
): Promise<SalesDoorMemoryReceipt> {
  const rep = await loadRepRow(slug);
  const supabase = createPrivilegedServerSupabaseClient();
  const activityResult = await supabase
    .from("sales_rep_activity_events")
    .select("id, event_type, occurred_at, reversed_at")
    .eq("rep_id", rep.id)
    .eq("client_event_id", input.doorActivityClientEventId)
    .maybeSingle();

  if (activityResult.error) {
    throw new SalesWorkspaceUnavailableError(
      readableStorageError(activityResult.error.message),
    );
  }
  if (!activityResult.data) {
    throw new SalesWorkspaceActionError(
      "The door knock is still waiting to sync. Retry the saved field queue first.",
      409,
    );
  }
  if (
    activityResult.data.event_type !== "door_knock" ||
    activityResult.data.reversed_at
  ) {
    throw new SalesWorkspaceActionError(
      "Door memory requires an active door-knock entry.",
      409,
    );
  }

  if (input.leadId) {
    const leadResult = await supabase
      .from("sales_rep_leads")
      .select("id")
      .eq("id", input.leadId)
      .eq("rep_id", rep.id)
      .maybeSingle();
    if (leadResult.error) {
      throw new SalesWorkspaceUnavailableError(
        readableStorageError(leadResult.error.message),
      );
    }
    if (!leadResult.data) {
      throw new SalesWorkspaceActionError(
        "That homeowner does not belong to this sales workspace.",
        400,
      );
    }
  }

  const expected = {
    doorActivityId: String(activityResult.data.id),
    propertyAddress: input.propertyAddress,
    addressKey: input.addressKey,
    disposition: input.disposition,
    notes: input.notes,
    leadId: input.leadId,
  };
  const priorResult = await supabase
    .from("sales_rep_door_visits")
    .select(SALES_DOOR_MEMORY_SELECT)
    .eq("rep_id", rep.id)
    .eq("client_event_id", input.clientEventId)
    .maybeSingle();
  if (priorResult.error) {
    throw new SalesWorkspaceUnavailableError(
      readableStorageError(priorResult.error.message),
    );
  }
  if (priorResult.data) {
    const prior = priorResult.data as SalesDoorMemoryRow;
    assertDoorMemoryRetryMatches(prior, expected);
    return doorMemoryReceiptFromRow(prior);
  }

  const insertResult = await supabase
    .from("sales_rep_door_visits")
    .insert({
      rep_id: rep.id,
      door_activity_id: expected.doorActivityId,
      lead_id: input.leadId,
      client_event_id: input.clientEventId,
      property_address: input.propertyAddress,
      address_key: input.addressKey,
      disposition: input.disposition,
      notes: input.notes || null,
      occurred_at: activityResult.data.occurred_at,
    })
    .select(SALES_DOOR_MEMORY_SELECT)
    .single();

  if (!insertResult.error && insertResult.data) {
    return doorMemoryReceiptFromRow(insertResult.data as SalesDoorMemoryRow);
  }
  if (insertResult.error?.code !== "23505") {
    throw new SalesWorkspaceUnavailableError(
      readableStorageError(insertResult.error?.message ?? "sales_rep_door_visits"),
    );
  }

  // A retried device request may carry a fresh memory UUID after the same door
  // was already accepted. Resolve the unique door binding and prove its payload
  // is identical before treating it as success.
  const doorRetryResult = await supabase
    .from("sales_rep_door_visits")
    .select(SALES_DOOR_MEMORY_SELECT)
    .eq("rep_id", rep.id)
    .eq("door_activity_id", expected.doorActivityId)
    .maybeSingle();
  if (doorRetryResult.error || !doorRetryResult.data) {
    throw new SalesWorkspaceUnavailableError(
      readableStorageError(
        doorRetryResult.error?.message ?? "sales_rep_door_visits",
      ),
    );
  }
  const retried = doorRetryResult.data as SalesDoorMemoryRow;
  assertDoorMemoryRetryMatches(retried, expected);
  return doorMemoryReceiptFromRow(retried);
}

export async function reverseSalesActivity(
  slug: string,
  activityId: string,
  referenceDate = new Date(),
): Promise<SalesActivityReversalReceipt> {
  const rep = await loadRepRow(slug);
  const supabase = createPrivilegedServerSupabaseClient();
  const { data, error } = await supabase
    .from("sales_rep_activity_events")
    .select("id, event_type, quantity, occurred_at, lead_id, reversed_at")
    .eq("id", activityId)
    .eq("rep_id", rep.id)
    .maybeSingle();

  if (error) {
    throw new SalesWorkspaceUnavailableError(readableStorageError(error.message));
  }
  if (!data) {
    throw new SalesWorkspaceActionError(
      "That field activity is not available to undo.",
      404,
    );
  }

  const activity = data as ReversibleSalesActivityRow;
  if (activity.event_type === "door_knock") {
    const memoryResult = await supabase
      .from("sales_rep_door_visits")
      .select("id")
      .eq("rep_id", rep.id)
      .eq("door_activity_id", activity.id)
      .maybeSingle();
    if (memoryResult.error) {
      throw new SalesWorkspaceUnavailableError(
        readableStorageError(memoryResult.error.message),
      );
    }
    if (memoryResult.data) {
      throw new SalesWorkspaceActionError(
        "This door already has saved address memory and cannot be undone.",
        409,
      );
    }
  }
  if (
    !isSalesActivityUndoAvailable(
      {
        eventType: activity.event_type,
        leadId: activity.lead_id,
        occurredAt: activity.occurred_at,
        reversedAt: activity.reversed_at,
      },
      referenceDate,
    )
  ) {
    throw new SalesWorkspaceActionError(
      "That activity can no longer be undone. Recent quick actions have a ten-minute undo window.",
    );
  }

  const reversedAt = referenceDate.toISOString();
  const { data: reversed, error: reverseError } = await supabase
    .from("sales_rep_activity_events")
    .update({
      reversed_at: reversedAt,
      reversed_by: "hq_admin_session",
      reversal_reason: "operator_undo",
    })
    .eq("id", activity.id)
    .eq("rep_id", rep.id)
    .is("reversed_at", null)
    .select("id, event_type, quantity, occurred_at, reversed_at")
    .maybeSingle();

  if (reverseError) {
    throw new SalesWorkspaceUnavailableError(
      readableStorageError(reverseError.message),
    );
  }
  if (!reversed?.reversed_at) {
    throw new SalesWorkspaceActionError(
      "That field activity was already corrected.",
    );
  }

  return {
    id: reversed.id,
    activityType: reversed.event_type as SalesActivityType,
    quantity: Number(reversed.quantity) || activity.quantity,
    occurredAt: reversed.occurred_at,
    reversedAt: reversed.reversed_at,
  };
}
