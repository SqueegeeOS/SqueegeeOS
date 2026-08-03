import "server-only";

import { isMembershipActive } from "@/lib/membership/membership-status";
import { MEMBERSHIP_APPOINTMENT_TYPE } from "@/lib/membership/membership-appointment-types";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { JOBBER_CONNECTION_ID } from "./jobber-oauth-config";

const PORTAL_PROJECTION_ACTOR = "atlas_pulse_jobber_projection";
const AUTOMATIC_PROPERTY_LINK_ACTOR = "atlas_pulse_customer_pair";
const AUTOMATIC_PROPERTY_LINK_REASON =
  "HQ confirmed the same customer and both systems contain exactly one eligible property";
const BUSINESS_TIME_ZONE = "America/Los_Angeles";

interface JobberClientPropertyRow {
  id: string;
}

interface JobberClientProjectionRow {
  properties: JobberClientPropertyRow[] | null;
  property_count: number;
  properties_complete: boolean;
}

interface MembershipRow {
  id: string;
  homeowner_id: string;
  property_id: string;
  status: string;
  payment_setup_completed_at: string | null;
  stripe_payment_method_id: string | null;
  stripe_customer_id: string | null;
  agreement_id: string | null;
  sales_tier: string | null;
  visit_price: number | null;
}

interface PropertyRow {
  id: string;
  homeowner_id: string;
}

interface MemberTarget {
  membership: MembershipRow;
  property: PropertyRow;
}

interface PropertyLinkRow {
  id: string;
  external_property_id: string;
  property_id: string;
  membership_id: string;
  link_state: "active" | "revoked";
}

export interface JobberPortalVisitCandidate {
  id: string;
  external_visit_id: string;
  external_job_id: string;
  external_client_id: string;
  external_property_id: string;
  title: string | null;
  visit_status: string;
  is_complete: boolean;
  scheduled_start: string | null;
  scheduled_end: string | null;
  completed_at: string | null;
  source_observed_at: string;
  source_payload_hash: string;
}

interface ExistingAppointmentRow {
  id: string;
  property_id: string;
  external_id: string;
  service_type: string;
  scheduled_at: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  notes: string | null;
  completed_at: string | null;
  source_payload_hash: string | null;
}

interface ProjectionTarget {
  link: PropertyLinkRow;
  member: MemberTarget;
  propertyLinkCreated: boolean;
}

export type JobberPortalProjectionStatus =
  | "projected"
  | "current"
  | "no_upcoming_visit"
  | "needs_property_review"
  | "no_active_membership"
  | "error";

export interface JobberPortalProjectionResult {
  status: JobberPortalProjectionStatus;
  appointmentId: string | null;
  externalVisitId: string | null;
  scheduledAt: string | null;
  propertyLinkCreated: boolean;
  message: string;
}

export interface JobberPortalReconciliationSummary {
  pairedCustomers: number;
  projected: number;
  current: number;
  noUpcomingVisit: number;
  needsPropertyReview: number;
  noActiveMembership: number;
  errors: number;
}

function safeProperties(value: JobberClientPropertyRow[] | null): JobberClientPropertyRow[] {
  return Array.isArray(value)
    ? value.filter(
        (property): property is JobberClientPropertyRow =>
          typeof property?.id === "string" && property.id.trim().length > 0,
      )
    : [];
}

function validInstant(value: string | null): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function jobberVisitAppointmentStatus(
  visit: Pick<JobberPortalVisitCandidate, "visit_status" | "is_complete">,
): ExistingAppointmentRow["status"] {
  const status = visit.visit_status.trim().toUpperCase();
  if (/NO[ _-]?SHOW/.test(status)) return "no_show";
  if (status.includes("CANCEL") || status === "REMOVED") return "cancelled";
  if (visit.is_complete || status.includes("COMPLETE")) return "completed";
  return "scheduled";
}

export function selectNearestUpcomingJobberVisit(
  visits: JobberPortalVisitCandidate[],
  referenceDate = new Date(),
): JobberPortalVisitCandidate | null {
  const referenceTime = referenceDate.getTime();
  return (
    visits
      .filter((visit) => {
        const startTime = validInstant(visit.scheduled_start);
        return (
          startTime !== null &&
          startTime >= referenceTime &&
          jobberVisitAppointmentStatus(visit) === "scheduled"
        );
      })
      .sort(
        (left, right) =>
          (validInstant(left.scheduled_start) ?? Number.MAX_SAFE_INTEGER) -
          (validInstant(right.scheduled_start) ?? Number.MAX_SAFE_INTEGER),
      )[0] ?? null
  );
}

export function buildJobberPortalTimeWindow(
  scheduledStart: string | null,
  scheduledEnd: string | null,
): string | null {
  if (validInstant(scheduledStart) === null || validInstant(scheduledEnd) === null) {
    return null;
  }
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  });
  return `${formatter.format(new Date(scheduledStart!))}–${formatter.format(
    new Date(scheduledEnd!),
  )}`;
}

export function buildJobberPortalAppointmentValues(input: {
  visit: JobberPortalVisitCandidate;
  memberProfileId: string;
  propertyId: string;
}) {
  const status = jobberVisitAppointmentStatus(input.visit);
  const timeWindow = buildJobberPortalTimeWindow(
    input.visit.scheduled_start,
    input.visit.scheduled_end,
  );
  return {
    member_profile_id: input.memberProfileId,
    property_id: input.propertyId,
    service_type: input.visit.title?.trim() || MEMBERSHIP_APPOINTMENT_TYPE,
    scheduled_at: input.visit.scheduled_start!,
    status,
    technician_name: null,
    notes: timeWindow ? `Time window: ${timeWindow}` : null,
    completed_at:
      status === "completed" ? input.visit.completed_at ?? input.visit.scheduled_start : null,
    provider: "jobber",
    external_id: input.visit.external_visit_id,
    provenance_state: "provider_imported",
    verification_state: "verified",
    match_state: "matched",
    source_observed_at: input.visit.source_observed_at,
    source_payload_hash: input.visit.source_payload_hash,
  } as const;
}

function isEligibleMemberTarget(membership: MembershipRow, property: PropertyRow): boolean {
  return Boolean(
    membership.property_id === property.id &&
      membership.homeowner_id === property.homeowner_id &&
      isMembershipActive(membership),
  );
}

async function loadMemberTargets(homeownerId: string): Promise<MemberTarget[]> {
  const supabase = createServiceRoleSupabaseClient();
  const membershipsResult = await supabase
    .from("memberships")
    .select(
      "id, homeowner_id, property_id, status, payment_setup_completed_at, stripe_payment_method_id, stripe_customer_id, agreement_id, sales_tier, visit_price",
    )
    .eq("homeowner_id", homeownerId)
    .eq("status", "active");
  if (membershipsResult.error) throw new Error(membershipsResult.error.message);
  const memberships = (membershipsResult.data ?? []) as MembershipRow[];
  if (memberships.length === 0) return [];

  const propertyIds = [...new Set(memberships.map((membership) => membership.property_id))];
  const propertiesResult = await supabase
    .from("properties")
    .select("id, homeowner_id")
    .in("id", propertyIds);
  if (propertiesResult.error) throw new Error(propertiesResult.error.message);
  const properties = new Map(
    ((propertiesResult.data ?? []) as PropertyRow[]).map((property) => [property.id, property]),
  );
  return memberships.flatMap((membership) => {
    const property = properties.get(membership.property_id);
    return property && isEligibleMemberTarget(membership, property)
      ? [{ membership, property }]
      : [];
  });
}

async function ensureMemberProfileId(homeownerId: string): Promise<string> {
  const supabase = createServiceRoleSupabaseClient();
  const existing = await supabase
    .from("member_profiles")
    .select("id")
    .eq("homeowner_id", homeownerId)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data?.id) return existing.data.id as string;

  const created = await supabase
    .from("member_profiles")
    .insert({ homeowner_id: homeownerId, membership_tier: "standard" })
    .select("id")
    .single();
  if (created.error) throw new Error(created.error.message);
  return created.data.id as string;
}

async function ensureAutomaticPropertyLink(input: {
  externalPropertyId: string;
  member: MemberTarget;
}): Promise<PropertyLinkRow | null> {
  const supabase = createServiceRoleSupabaseClient();
  const existingResult = await supabase
    .from("jobber_property_links")
    .select("id, external_property_id, property_id, membership_id, link_state")
    .eq("connection_id", JOBBER_CONNECTION_ID)
    .eq("external_property_id", input.externalPropertyId)
    .maybeSingle();
  if (existingResult.error) throw new Error(existingResult.error.message);
  const existing = (existingResult.data as PropertyLinkRow | null) ?? null;
  if (existing?.link_state === "active") {
    return existing.property_id === input.member.property.id &&
      existing.membership_id === input.member.membership.id
      ? existing
      : null;
  }
  // Automatic single-property pairing may create a missing link, but it must
  // never override an explicit HQ revocation. Relinking requires the supervised
  // property workflow and a fresh membership-job verification.
  if (existing?.link_state === "revoked") return null;

  const propertyConflict = await supabase
    .from("jobber_property_links")
    .select("id, external_property_id")
    .eq("connection_id", JOBBER_CONNECTION_ID)
    .eq("property_id", input.member.property.id)
    .eq("link_state", "active")
    .maybeSingle();
  if (propertyConflict.error) throw new Error(propertyConflict.error.message);
  if (
    propertyConflict.data &&
    propertyConflict.data.external_property_id !== input.externalPropertyId
  ) {
    return null;
  }

  const now = new Date().toISOString();
  if (!existing) {
    const inserted = await supabase
      .from("jobber_property_links")
      .insert({
        connection_id: JOBBER_CONNECTION_ID,
        external_property_id: input.externalPropertyId,
        property_id: input.member.property.id,
        membership_id: input.member.membership.id,
        link_state: "active",
        linked_by: AUTOMATIC_PROPERTY_LINK_ACTOR,
        link_reason: AUTOMATIC_PROPERTY_LINK_REASON,
        linked_at: now,
      })
      .select("id, external_property_id, property_id, membership_id, link_state")
      .single();
    if (inserted.error) {
      if (inserted.error.code === "23505") return null;
      throw new Error(inserted.error.message);
    }
    return inserted.data as PropertyLinkRow;
  }

  return null;
}

async function resolveProjectionTargets(input: {
  externalClientId: string;
  homeownerId: string;
  members: MemberTarget[];
}): Promise<ProjectionTarget[]> {
  const supabase = createServiceRoleSupabaseClient();
  const [clientResult, visitPropertiesResult] = await Promise.all([
    supabase
      .from("jobber_client_projections")
      .select("properties, property_count, properties_complete")
      .eq("connection_id", JOBBER_CONNECTION_ID)
      .eq("external_client_id", input.externalClientId)
      .maybeSingle(),
    supabase
      .from("jobber_visit_projections")
      .select("external_property_id")
      .eq("connection_id", JOBBER_CONNECTION_ID)
      .eq("external_client_id", input.externalClientId),
  ]);
  if (clientResult.error) throw new Error(clientResult.error.message);
  if (visitPropertiesResult.error) throw new Error(visitPropertiesResult.error.message);
  const client = (clientResult.data as JobberClientProjectionRow | null) ?? null;
  if (!client) return [];

  const clientProperties = safeProperties(client.properties);
  const externalPropertyIds = [
    ...new Set([
      ...clientProperties.map((property) => property.id),
      ...((visitPropertiesResult.data ?? []) as Array<{ external_property_id: string }>).map(
        (row) => row.external_property_id,
      ),
    ]),
  ];
  const linksResult = externalPropertyIds.length
    ? await supabase
        .from("jobber_property_links")
        .select("id, external_property_id, property_id, membership_id, link_state")
        .eq("connection_id", JOBBER_CONNECTION_ID)
        .eq("link_state", "active")
        .in("external_property_id", externalPropertyIds)
    : { data: [], error: null };
  if (linksResult.error) throw new Error(linksResult.error.message);

  const memberByMembershipId = new Map(
    input.members.map((member) => [member.membership.id, member]),
  );
  const activeTargets = ((linksResult.data ?? []) as PropertyLinkRow[]).flatMap(
    (link): ProjectionTarget[] => {
      const member = memberByMembershipId.get(link.membership_id);
      return member && member.property.id === link.property_id
        ? [{ link, member, propertyLinkCreated: false }]
        : [];
    },
  );
  if (activeTargets.length > 0) return activeTargets;

  if (
    input.members.length !== 1 ||
    !client.properties_complete ||
    client.property_count !== 1 ||
    clientProperties.length !== 1
  ) {
    return [];
  }
  const link = await ensureAutomaticPropertyLink({
    externalPropertyId: clientProperties[0].id,
    member: input.members[0],
  });
  return link
    ? [{ link, member: input.members[0], propertyLinkCreated: true }]
    : [];
}

async function recordAppointmentSourceEvent(input: {
  appointmentId: string;
  eventType: "provider_observed" | "source_changed";
  visit: JobberPortalVisitCandidate;
  propertyLinkId: string;
}): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const event = await supabase.from("appointment_source_events").insert({
    appointment_id: input.appointmentId,
    provider: "jobber",
    external_id: input.visit.external_visit_id,
    event_type: input.eventType,
    actor: PORTAL_PROJECTION_ACTOR,
    reason: "Projected confirmed Jobber scheduling truth into the member portal",
    evidence: {
      projection_id: input.visit.id,
      property_link_id: input.propertyLinkId,
      scheduled_at: input.visit.scheduled_start,
      visit_status: input.visit.visit_status,
    },
  });
  if (event.error) throw new Error(event.error.message);
}

async function reconcileProjectionTarget(input: {
  target: ProjectionTarget;
  externalClientId: string;
  homeownerId: string;
  referenceDate: Date;
}): Promise<JobberPortalProjectionResult> {
  const supabase = createServiceRoleSupabaseClient();
  const visitsResult = await supabase
    .from("jobber_visit_projections")
    .select(
      "id, external_visit_id, external_job_id, external_client_id, external_property_id, title, visit_status, is_complete, scheduled_start, scheduled_end, completed_at, source_observed_at, source_payload_hash",
    )
    .eq("connection_id", JOBBER_CONNECTION_ID)
    .eq("external_client_id", input.externalClientId)
    .eq("external_property_id", input.target.link.external_property_id)
    .eq("match_state", "matched")
    .eq("matched_property_id", input.target.member.property.id)
    .not("scheduled_start", "is", null)
    .order("scheduled_start", { ascending: true });
  if (visitsResult.error) throw new Error(visitsResult.error.message);
  const visits = (visitsResult.data ?? []) as JobberPortalVisitCandidate[];
  const nearest = selectNearestUpcomingJobberVisit(visits, input.referenceDate);

  const profileId = await ensureMemberProfileId(input.homeownerId);
  const appointmentsResult = await supabase
    .from("member_appointments")
    .select(
      "id, property_id, external_id, service_type, scheduled_at, status, notes, completed_at, source_payload_hash",
    )
    .eq("property_id", input.target.member.property.id)
    .eq("provider", "jobber");
  if (appointmentsResult.error) throw new Error(appointmentsResult.error.message);
  const appointments = (appointmentsResult.data ?? []) as ExistingAppointmentRow[];
  const appointmentByExternalId = new Map(
    appointments.map((appointment) => [appointment.external_id, appointment]),
  );
  let changed = false;
  const eligibleExternalVisitIds = new Set(
    visits.map((visit) => visit.external_visit_id),
  );

  const noLongerMembershipAppointments = appointments.filter(
    (appointment) =>
      appointment.status === "scheduled" &&
      !eligibleExternalVisitIds.has(appointment.external_id),
  );
  if (noLongerMembershipAppointments.length > 0) {
    const demoted = await supabase
      .from("member_appointments")
      .update({
        status: "cancelled",
        verification_state: "unverified",
        completed_at: null,
      })
      .in(
        "id",
        noLongerMembershipAppointments.map((appointment) => appointment.id),
      );
    if (demoted.error) throw new Error(demoted.error.message);
    changed = true;
  }

  for (const visit of visits) {
    const existing = appointmentByExternalId.get(visit.external_visit_id);
    if (!visit.scheduled_start) continue;
    const values = buildJobberPortalAppointmentValues({
      visit,
      memberProfileId: profileId,
      propertyId: input.target.member.property.id,
    });
    if (!existing) {
      const identityConflict = await supabase
        .from("member_appointments")
        .select("id, property_id")
        .eq("provider", "jobber")
        .eq("external_id", visit.external_visit_id)
        .maybeSingle();
      if (identityConflict.error) throw new Error(identityConflict.error.message);
      if (
        identityConflict.data &&
        identityConflict.data.property_id !== input.target.member.property.id
      ) {
        continue;
      }
      const inserted = await supabase
        .from("member_appointments")
        .insert(values)
        .select(
          "id, property_id, external_id, service_type, scheduled_at, status, notes, completed_at, source_payload_hash",
        )
        .single();
      if (inserted.error) throw new Error(inserted.error.message);
      const insertedAppointment = inserted.data as ExistingAppointmentRow;
      appointmentByExternalId.set(visit.external_visit_id, insertedAppointment);
      await recordAppointmentSourceEvent({
        appointmentId: insertedAppointment.id,
        eventType: "provider_observed",
        visit,
        propertyLinkId: input.target.link.id,
      });
      changed = true;
      continue;
    }
    const needsUpdate =
      existing.scheduled_at !== values.scheduled_at ||
      existing.status !== values.status ||
      existing.service_type !== values.service_type ||
      existing.notes !== values.notes ||
      existing.completed_at !== values.completed_at ||
      existing.source_payload_hash !== values.source_payload_hash;
    if (!needsUpdate) continue;
    const updated = await supabase
      .from("member_appointments")
      .update(values)
      .eq("id", existing.id)
      .eq("property_id", input.target.member.property.id)
      .select("id")
      .single();
    if (updated.error) throw new Error(updated.error.message);
    await recordAppointmentSourceEvent({
      appointmentId: existing.id,
      eventType: "source_changed",
      visit,
      propertyLinkId: input.target.link.id,
    });
    changed = true;
  }

  if (!nearest) {
    return {
      status: "no_upcoming_visit",
      appointmentId: null,
      externalVisitId: null,
      scheduledAt: null,
      propertyLinkCreated: input.target.propertyLinkCreated,
      message: "Customer paired; no future Jobber service is scheduled yet.",
    };
  }

  const current = appointmentByExternalId.get(nearest.external_visit_id);
  if (current) {
    return {
      status: changed ? "projected" : "current",
      appointmentId: current.id,
      externalVisitId: nearest.external_visit_id,
      scheduledAt: nearest.scheduled_start,
      propertyLinkCreated: input.target.propertyLinkCreated,
      message: changed
        ? "The nearest Jobber visit was refreshed in the customer portal."
        : "The nearest Jobber visit is already current in the customer portal.",
    };
  }

  return {
    status: "needs_property_review",
    appointmentId: null,
    externalVisitId: nearest.external_visit_id,
    scheduledAt: nearest.scheduled_start,
    propertyLinkCreated: input.target.propertyLinkCreated,
    message: "The nearest Jobber visit could not be tied to the paired property.",
  };
}

function chooseNearestResult(results: JobberPortalProjectionResult[]): JobberPortalProjectionResult {
  const withDates = results
    .filter((result) => result.scheduledAt)
    .sort(
      (left, right) =>
        (validInstant(left.scheduledAt) ?? Number.MAX_SAFE_INTEGER) -
        (validInstant(right.scheduledAt) ?? Number.MAX_SAFE_INTEGER),
    );
  return withDates[0] ?? results[0];
}

export async function reconcilePairedCustomerPortalVisit(input: {
  externalClientId: string;
  homeownerId: string;
  referenceDate?: Date;
}): Promise<JobberPortalProjectionResult> {
  const members = await loadMemberTargets(input.homeownerId);
  if (members.length === 0) {
    return {
      status: "no_active_membership",
      appointmentId: null,
      externalVisitId: null,
      scheduledAt: null,
      propertyLinkCreated: false,
      message: "Customer paired; an active membership is required before a portal visit can appear.",
    };
  }
  const targets = await resolveProjectionTargets({ ...input, members });
  if (targets.length === 0) {
    return {
      status: "needs_property_review",
      appointmentId: null,
      externalVisitId: null,
      scheduledAt: null,
      propertyLinkCreated: false,
      message: "Customer paired; choose the matching property before a Jobber visit is shown.",
    };
  }

  const results: JobberPortalProjectionResult[] = [];
  for (const target of targets) {
    results.push(
      await reconcileProjectionTarget({
        target,
        externalClientId: input.externalClientId,
        homeownerId: input.homeownerId,
        referenceDate: input.referenceDate ?? new Date(),
      }),
    );
  }
  return chooseNearestResult(results);
}

export async function reconcileAllPairedCustomerPortalVisits(): Promise<JobberPortalReconciliationSummary> {
  const supabase = createServiceRoleSupabaseClient();
  const links = await supabase
    .from("jobber_customer_links")
    .select("external_client_id, homeowner_id")
    .eq("connection_id", JOBBER_CONNECTION_ID)
    .eq("link_state", "active");
  if (links.error) throw new Error(links.error.message);

  const summary: JobberPortalReconciliationSummary = {
    pairedCustomers: links.data?.length ?? 0,
    projected: 0,
    current: 0,
    noUpcomingVisit: 0,
    needsPropertyReview: 0,
    noActiveMembership: 0,
    errors: 0,
  };
  for (const link of (links.data ?? []) as Array<{
    external_client_id: string;
    homeowner_id: string;
  }>) {
    try {
      const result = await reconcilePairedCustomerPortalVisit({
        externalClientId: link.external_client_id,
        homeownerId: link.homeowner_id,
      });
      if (result.status === "projected") summary.projected += 1;
      else if (result.status === "current") summary.current += 1;
      else if (result.status === "no_upcoming_visit") summary.noUpcomingVisit += 1;
      else if (result.status === "needs_property_review") {
        summary.needsPropertyReview += 1;
      } else if (result.status === "no_active_membership") {
        summary.noActiveMembership += 1;
      } else summary.errors += 1;
    } catch (error) {
      summary.errors += 1;
      console.error("[jobber-portal-projection] customer reconciliation failed", {
        externalClientId: link.external_client_id,
        reason: error instanceof Error ? error.message : "unknown",
      });
    }
  }
  return summary;
}
