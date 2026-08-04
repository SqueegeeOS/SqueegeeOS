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
  SalesLeadStatus,
  SalesRepLead,
  SalesWorkspacePayload,
} from "./workspace-types";
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
  fullName: string;
  propertyAddress: string;
  email: string | null;
}

interface SalesLeadRow {
  id: string;
  full_name: string;
  property_address: string;
  phone_normalized: string | null;
  email_normalized: string | null;
  status: SalesLeadStatus;
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
  qualification_status: "pending" | "active" | "qualified" | "cancelled";
  attributed_arr_cents: number;
  attributed_at: string;
}

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
    fullName: row.full_name,
    propertyAddress: row.property_address,
    phone: row.phone_normalized,
    email: row.email_normalized,
    status: row.status,
    estimatedArrCents: Number(row.estimated_arr_cents) || 0,
    nextFollowUpAt: row.next_follow_up_at,
    notes: row.notes ?? "",
    smsConsentStatus: row.sms_consent_status,
    emailConsentStatus: row.email_consent_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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
      .select("id, full_name, property_address, email_normalized")
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
      fullName: String(data.full_name),
      propertyAddress: String(data.property_address),
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

  try {
    await reconcileSignedMembershipAttributionsForRep(rep.id, 5);
  } catch (error) {
    // Sales reporting repair must never make the field workspace unavailable.
    console.error("[sales-workspace] nonfatal attribution reconciliation failure", error);
  }

  const [leadsResult, activityResult, attributionResult] = await Promise.all([
    supabase
      .from("sales_rep_leads")
      .select(
        "id, full_name, property_address, phone_normalized, email_normalized, status, estimated_arr_cents, next_follow_up_at, notes, sms_consent_status, email_consent_status, created_at, updated_at",
      )
      .eq("rep_id", rep.id)
      .order("next_follow_up_at", { ascending: true, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("sales_rep_activity_events")
      .select("event_type, quantity")
      .eq("rep_id", rep.id)
      .is("reversed_at", null)
      .gte("occurred_at", startUtc.toISOString())
      .lt("occurred_at", endUtc.toISOString()),
    supabase
      .from("sales_rep_attributions")
      .select("qualification_status, attributed_arr_cents, attributed_at")
      .eq("rep_id", rep.id),
  ]);

  const firstError = leadsResult.error ?? activityResult.error ?? attributionResult.error;
  if (firstError) {
    throw new SalesWorkspaceUnavailableError(readableStorageError(firstError.message));
  }

  const leads = ((leadsResult.data ?? []) as SalesLeadRow[]).map(leadFromRow);
  const activities = (activityResult.data ?? []) as SalesActivityRow[];
  const attributions = (attributionResult.data ?? []) as SalesAttributionRow[];
  const activityCount = (eventType: string) =>
    activities.reduce(
      (total, activity) =>
        total + (activity.event_type === eventType ? Number(activity.quantity) || 0 : 0),
      0,
    );
  const openLeads = leads.filter(
    (lead) => !["signed", "won", "lost"].includes(lead.status),
  );
  const closedAttributions = attributions.filter(
    (attribution) => attribution.qualification_status !== "cancelled",
  );
  const attributionsToday = closedAttributions.filter((attribution) => {
    const attributedAt = new Date(attribution.attributed_at);
    return attributedAt >= startUtc && attributedAt < endUtc;
  });

  return {
    profile: profileFromRow(rep),
    metrics: {
      doorsToday: activityCount("door_knock"),
      conversationsToday: activityCount("conversation"),
      presentationsToday: activityCount("presentation_started"),
      leadsToday: leads.filter((lead) => {
        const createdAt = new Date(lead.createdAt);
        return createdAt >= startUtc && createdAt < endUtc;
      }).length,
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
      qualifiedRetainedMembers: attributions.filter(
        (attribution) => attribution.qualification_status === "qualified",
      ).length,
    },
    leads,
    generatedAt: referenceDate.toISOString(),
  };
}

export async function createSalesLead(
  slug: string,
  input: Required<Omit<CreateSalesLeadInput, "phone" | "email" | "nextFollowUpAt" | "notes">> & {
    phone: string | null;
    email: string | null;
    nextFollowUpAt: string | null;
    notes: string;
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
      "id, full_name, property_address, phone_normalized, email_normalized, status, estimated_arr_cents, next_follow_up_at, notes, sms_consent_status, email_consent_status, created_at, updated_at",
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

  return lead;
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
