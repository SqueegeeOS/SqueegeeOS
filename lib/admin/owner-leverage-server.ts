import "server-only";

import { randomUUID } from "node:crypto";
import {
  formatBusinessCalendarDate,
  getBusinessCalendarWeekUtcBounds,
} from "@/lib/admin/company-business-timezone";
import {
  isMissingFieldIndependenceReviewSchema,
  loadFieldIndependenceReviews,
} from "@/lib/field-operations/independence-review-server";
import { JOBBER_CONNECTION_ID } from "@/lib/care-operations/jobber-oauth-config";
import {
  createServiceRoleSupabaseClient,
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import {
  GROWTH_CHANNELS,
  calculateOwnerLeverageMetrics,
  emptyOwnerLeverageMetrics,
  type GrowthChannel,
  type GrowthOperator,
  type GrowthSessionStatus,
  type GrowthWorkSession,
  type OwnerAttributedClose,
  type OwnerLeverageReviewEvidence,
  type OwnerLeverageSnapshot,
  type OwnerPresentationCohortRow,
} from "./owner-leverage";

interface SalesRepRow {
  id: string;
  slug: string;
  display_name: string;
  role_title: string;
  benefit_profile: unknown;
}

interface GrowthWorkSessionRow {
  id: string;
  rep_id: string;
  business_date: string;
  channel: GrowthChannel;
  status: GrowthSessionStatus;
  started_at: string;
  ended_at: string | null;
  break_minutes: number;
  notes: string | null;
}

interface AttributionRow {
  rep_id: string;
  attributed_arr_cents: number;
  attributed_at: string;
}

interface PresentationRow {
  id: string;
  sales_rep_id: string;
  signed_at: string | null;
}

interface AppointmentRow {
  id: string;
  external_id: string | null;
}

function isGrowthOperator(row: SalesRepRow): boolean {
  return Boolean(
    row.benefit_profile &&
      typeof row.benefit_profile === "object" &&
      (row.benefit_profile as Record<string, unknown>).growth_operator === true,
  );
}

function toOperator(row: SalesRepRow): GrowthOperator {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    roleTitle: row.role_title,
  };
}

function toSession(
  row: GrowthWorkSessionRow,
  operatorById: Map<string, GrowthOperator>,
): GrowthWorkSession {
  const operator = operatorById.get(row.rep_id);
  return {
    id: row.id,
    operatorId: row.rep_id,
    operatorSlug: operator?.slug ?? "unknown",
    operatorName: operator?.displayName ?? "Unknown operator",
    businessDate: row.business_date,
    channel: row.channel,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    breakMinutes: Number(row.break_minutes),
    notes: row.notes,
  };
}

function missingOwnerLeverageSchema(error: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!error) return false;
  if (isMissingFieldIndependenceReviewSchema(error)) return true;
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42P01" ||
    ((message.includes("growth_work_sessions") ||
      message.includes("field_independence_reviews")) &&
      (message.includes("does not exist") ||
        message.includes("schema cache") ||
        message.includes("could not find")))
  );
}

function emptySnapshot(reference: Date, warning: string): OwnerLeverageSnapshot {
  const week = getBusinessCalendarWeekUtcBounds(reference);
  return {
    generatedAt: new Date().toISOString(),
    source: "unavailable",
    schemaAvailable: false,
    period: {
      businessWeekStart: week.startCalendarDate,
      businessWeekEndExclusive: week.endCalendarDateExclusive,
      today: formatBusinessCalendarDate(reference),
    },
    operators: [],
    openSessions: [],
    recentSessions: [],
    metrics: emptyOwnerLeverageMetrics(),
    unreviewedCompletedVisits: 0,
    sources: {
      fieldReviews: "unavailable",
      growthSessions: "unavailable",
      signedArrAttribution: "unavailable",
      jobberCompletion: "unavailable",
    },
    warnings: [warning],
  };
}

async function loadOpenExceptions(
  appointmentIds: string[],
): Promise<{ appointmentIds: Set<string>; warning: string | null }> {
  const ids = [...new Set(appointmentIds)];
  const open = new Set<string>();
  if (ids.length === 0) return { appointmentIds: open, warning: null };
  const supabase = createServiceRoleSupabaseClient();
  const [followUps, serviceCases] = await Promise.all([
    supabase
      .from("property_assessments")
      .select("visit_id")
      .in("visit_id", ids)
      .eq("follow_up_status", "open")
      .limit(2_000),
    supabase
      .from("customer_service_cases")
      .select("appointment_id")
      .in("appointment_id", ids)
      .in("status", ["open", "acknowledged"])
      .limit(2_000),
  ]);
  if (followUps.error) {
    return {
      appointmentIds: open,
      warning: "Field follow-up guardrails could not be verified.",
    };
  }
  for (const row of followUps.data ?? []) {
    if (typeof row.visit_id === "string") open.add(row.visit_id);
  }
  if (serviceCases.error) {
    return {
      appointmentIds: open,
      warning:
        "Customer service-case guardrails are unavailable until migration 060 is active.",
    };
  }
  for (const row of serviceCases.data ?? []) {
    if (typeof row.appointment_id === "string") open.add(row.appointment_id);
  }
  return { appointmentIds: open, warning: null };
}

async function countUnreviewedCompletedVisits(input: {
  weekStart: string;
  weekEnd: string;
  reviewedAppointmentIds: Set<string>;
}): Promise<{ count: number; available: boolean; warning: string | null }> {
  const supabase = createServiceRoleSupabaseClient();
  const appointments = await supabase
    .from("member_appointments")
    .select("id, external_id")
    .eq("provider", "jobber")
    .eq("verification_state", "verified")
    .eq("match_state", "matched")
    .gte("scheduled_at", input.weekStart)
    .lt("scheduled_at", input.weekEnd)
    .limit(2_000);
  if (appointments.error) {
    return {
      count: 0,
      available: false,
      warning: "Verified Jobber appointment coverage could not be read.",
    };
  }
  const rows = (appointments.data ?? []) as AppointmentRow[];
  const externalIds = rows.flatMap((row) =>
    row.external_id ? [row.external_id] : [],
  );
  if (externalIds.length === 0) return { count: 0, available: true, warning: null };

  const [projections, fieldRecords] = await Promise.all([
    supabase
      .from("jobber_visit_projections")
      .select("external_visit_id")
      .eq("connection_id", JOBBER_CONNECTION_ID)
      .in("external_visit_id", externalIds)
      .eq("is_complete", true)
      .limit(2_000),
    supabase
      .from("property_assessments")
      .select("visit_id")
      .in(
        "visit_id",
        rows.map((row) => row.id),
      )
      .not("field_record_id", "is", null)
      .limit(2_000),
  ]);
  if (projections.error || fieldRecords.error) {
    return {
      count: 0,
      available: false,
      warning: "Completed, documented Jobber visits could not be reconciled.",
    };
  }
  const completedExternalIds = new Set(
    (projections.data ?? []).flatMap((row) =>
      typeof row.external_visit_id === "string" ? [row.external_visit_id] : [],
    ),
  );
  const documentedAppointmentIds = new Set(
    (fieldRecords.data ?? []).flatMap((row) =>
      typeof row.visit_id === "string" ? [row.visit_id] : [],
    ),
  );
  return {
    count: rows.filter(
      (row) =>
        row.external_id &&
        completedExternalIds.has(row.external_id) &&
        documentedAppointmentIds.has(row.id) &&
        !input.reviewedAppointmentIds.has(row.id),
    ).length,
    available: true,
    warning: null,
  };
}

export async function loadOwnerLeverageSnapshot(
  reference: Date = new Date(),
): Promise<OwnerLeverageSnapshot> {
  if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
    return emptySnapshot(
      reference,
      "Supabase service-role access is not configured in this environment.",
    );
  }

  const supabase = createServiceRoleSupabaseClient();
  const week = getBusinessCalendarWeekUtcBounds(reference);
  const today = formatBusinessCalendarDate(reference);
  const repsResult = await supabase
    .from("sales_reps")
    .select("id, slug, display_name, role_title, benefit_profile")
    .eq("status", "active")
    .order("display_name", { ascending: true });
  if (repsResult.error) {
    return emptySnapshot(reference, "Growth operator profiles could not load.");
  }
  const operators = ((repsResult.data ?? []) as SalesRepRow[])
    .filter(isGrowthOperator)
    .map(toOperator);
  const operatorIds = operators.map((operator) => operator.id);
  const operatorById = new Map(
    operators.map((operator) => [operator.id, operator]),
  );
  const warnings: string[] = [];
  if (operators.length === 0) {
    warnings.push("Apply migration 061 to activate Noah and Dasan as growth operators.");
  }

  const sessionResult = await supabase
    .from("growth_work_sessions")
    .select(
      "id, rep_id, business_date, channel, status, started_at, ended_at, break_minutes, notes",
    )
    .gte("business_date", week.startCalendarDate)
    .lt("business_date", week.endCalendarDateExclusive)
    .order("started_at", { ascending: false })
    .limit(500);
  if (sessionResult.error) {
    if (missingOwnerLeverageSchema(sessionResult.error)) {
      return emptySnapshot(
        reference,
        "Apply migration 061 to begin measuring owner time buyback and Growth Hours.",
      );
    }
    return emptySnapshot(reference, "Growth Hours could not be loaded safely.");
  }

  const reviewResult = await supabase
    .from("field_independence_reviews")
    .select("appointment_id")
    .gte("service_date", week.startCalendarDate)
    .lt("service_date", week.endCalendarDateExclusive)
    .limit(2_000);
  if (reviewResult.error) {
    if (missingOwnerLeverageSchema(reviewResult.error)) {
      return emptySnapshot(reference, "Apply migration 061 before recording field independence.");
    }
    return emptySnapshot(reference, "Field independence reviews could not load safely.");
  }
  const reviewedAppointmentIds = (reviewResult.data ?? []).flatMap((row) =>
    typeof row.appointment_id === "string" ? [row.appointment_id] : [],
  );
  const reviewsResult = await loadFieldIndependenceReviews(reviewedAppointmentIds);
  if (!reviewsResult.available) {
    return emptySnapshot(reference, "Apply migration 061 before recording field independence.");
  }
  const reviews = [...reviewsResult.byAppointmentId.values()];
  const exceptions = await loadOpenExceptions(
    reviews.map((review) => review.appointmentId),
  );
  if (exceptions.warning) warnings.push(exceptions.warning);
  const reviewEvidence: OwnerLeverageReviewEvidence[] = reviews.map((review) => ({
    review,
    hasOpenException: exceptions.appointmentIds.has(review.appointmentId),
  }));

  const emptyOperatorResult = { data: [], error: null };
  const [attributionResult, presentationResult, leadResult] =
    operatorIds.length > 0
      ? await Promise.all([
          supabase
            .from("sales_rep_attributions")
            .select("rep_id, attributed_arr_cents, attributed_at")
            .in("rep_id", operatorIds)
            .eq("attribution_source", "agreement_signature")
            .neq("qualification_status", "cancelled")
            .gte("attributed_at", week.startUtc.toISOString())
            .lt("attributed_at", week.endUtc.toISOString())
            .limit(2_000),
          supabase
            .from("presentations")
            .select("id, sales_rep_id, signed_at")
            .in("sales_rep_id", operatorIds)
            .gte("created_at", week.startUtc.toISOString())
            .lt("created_at", week.endUtc.toISOString())
            .limit(2_000),
          supabase
            .from("sales_rep_leads")
            .select("id")
            .in("rep_id", operatorIds)
            .gte("created_at", week.startUtc.toISOString())
            .lt("created_at", week.endUtc.toISOString())
            .limit(2_000),
        ])
      : [emptyOperatorResult, emptyOperatorResult, emptyOperatorResult];
  if (attributionResult.error || presentationResult.error || leadResult.error) {
    warnings.push(
      "Owner sales attribution is incomplete; no unattributed ARR is being assigned to a person.",
    );
  }

  const attributedCloses: OwnerAttributedClose[] = (
    (attributionResult.data ?? []) as AttributionRow[]
  ).map((row) => ({
    arrCents: Number(row.attributed_arr_cents),
    attributedAt: row.attributed_at,
    businessDate: formatBusinessCalendarDate(new Date(row.attributed_at)),
    operatorId: row.rep_id,
  }));
  const presentationCohort: OwnerPresentationCohortRow[] = (
    (presentationResult.data ?? []) as PresentationRow[]
  ).map((row) => ({
    id: row.id,
    operatorId: row.sales_rep_id,
    signedAt: row.signed_at,
  }));
  const sessions = ((sessionResult.data ?? []) as GrowthWorkSessionRow[]).map(
    (row) => toSession(row, operatorById),
  );
  const unreviewed = await countUnreviewedCompletedVisits({
    weekStart: week.startUtc.toISOString(),
    weekEnd: week.endUtc.toISOString(),
    reviewedAppointmentIds: new Set(reviewedAppointmentIds),
  });
  if (unreviewed.warning) warnings.push(unreviewed.warning);
  warnings.push(
    "Gross profit, CAC, and capacity utilization remain unscored until cost and available-capacity inputs exist.",
  );

  return {
    generatedAt: new Date().toISOString(),
    source: "supabase",
    schemaAvailable: true,
    period: {
      businessWeekStart: week.startCalendarDate,
      businessWeekEndExclusive: week.endCalendarDateExclusive,
      today,
    },
    operators,
    openSessions: sessions.filter((session) => session.status === "open"),
    recentSessions: sessions.filter((session) => session.status !== "open").slice(0, 12),
    metrics: calculateOwnerLeverageMetrics({
      today,
      reviews: reviewEvidence,
      sessions,
      attributedCloses,
      presentationCohort,
      leadsCreated: (leadResult.data ?? []).length,
    }),
    unreviewedCompletedVisits: unreviewed.count,
    sources: {
      fieldReviews: "ready",
      growthSessions: "ready",
      signedArrAttribution: attributionResult.error ? "unavailable" : "ready",
      jobberCompletion: unreviewed.available ? "ready" : "unavailable",
    },
    warnings,
  };
}

function validGrowthChannel(value: unknown): value is GrowthChannel {
  return GROWTH_CHANNELS.includes(value as GrowthChannel);
}

async function resolveGrowthOperator(slug: string): Promise<GrowthOperator> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Choose a valid growth operator.");
  }
  const result = await createServiceRoleSupabaseClient()
    .from("sales_reps")
    .select("id, slug, display_name, role_title, benefit_profile")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (result.error || !result.data || !isGrowthOperator(result.data as SalesRepRow)) {
    throw new Error("Choose Noah or Dasan as the Growth Hours owner.");
  }
  return toOperator(result.data as SalesRepRow);
}

export async function startGrowthWorkSession(input: {
  operatorSlug: string;
  channel: GrowthChannel;
}): Promise<GrowthWorkSession> {
  if (!validGrowthChannel(input.channel)) {
    throw new Error("Choose a valid growth channel.");
  }
  const operator = await resolveGrowthOperator(input.operatorSlug);
  const startedAt = new Date();
  const row = {
    id: randomUUID(),
    rep_id: operator.id,
    business_date: formatBusinessCalendarDate(startedAt),
    channel: input.channel,
    status: "open" as const,
    started_at: startedAt.toISOString(),
    ended_at: null,
    break_minutes: 0,
    notes: null,
  };
  const result = await createServiceRoleSupabaseClient()
    .from("growth_work_sessions")
    .insert(row)
    .select(
      "id, rep_id, business_date, channel, status, started_at, ended_at, break_minutes, notes",
    )
    .single();
  if (result.error || !result.data) {
    if (missingOwnerLeverageSchema(result.error)) {
      throw new Error("Apply HomeAtlas migration 061 before starting Growth Hours.");
    }
    if (result.error?.code === "23505") {
      throw new Error(`${operator.displayName} already has an open Growth Session.`);
    }
    throw new Error(result.error?.message ?? "Could not start Growth Hours.");
  }
  return toSession(
    result.data as GrowthWorkSessionRow,
    new Map([[operator.id, operator]]),
  );
}

export async function finishGrowthWorkSession(input: {
  sessionId: string;
  breakMinutes: number;
  notes?: string;
  cancel?: boolean;
}): Promise<GrowthWorkSession> {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(input.sessionId)) {
    throw new Error("Choose a valid Growth Session.");
  }
  if (
    !Number.isInteger(input.breakMinutes) ||
    input.breakMinutes < 0 ||
    input.breakMinutes > 240
  ) {
    throw new Error("Break time must be a whole number from 0 to 240 minutes.");
  }
  if ((input.notes ?? "").trim().length > 2_000) {
    throw new Error("Growth notes must be 2,000 characters or fewer.");
  }
  const supabase = createServiceRoleSupabaseClient();
  const current = await supabase
    .from("growth_work_sessions")
    .select(
      "id, rep_id, business_date, channel, status, started_at, ended_at, break_minutes, notes",
    )
    .eq("id", input.sessionId)
    .maybeSingle();
  if (current.error || !current.data) {
    throw new Error("Growth Session was not found.");
  }
  const session = current.data as GrowthWorkSessionRow;
  if (session.status !== "open") {
    throw new Error("This Growth Session is already closed.");
  }
  const endedAt = new Date();
  const elapsedMinutes = Math.round(
    (endedAt.getTime() - new Date(session.started_at).getTime()) / 60_000,
  );
  if (!input.cancel && elapsedMinutes <= input.breakMinutes) {
    throw new Error("Break time must be shorter than the Growth Session.");
  }
  if (!input.cancel && elapsedMinutes > 960) {
    throw new Error(
      "Sessions older than 16 hours cannot count. Cancel this timer and start a clean session.",
    );
  }
  const saved = await supabase
    .from("growth_work_sessions")
    .update({
      status: input.cancel ? "cancelled" : "completed",
      ended_at: endedAt.toISOString(),
      break_minutes: input.cancel ? 0 : input.breakMinutes,
      notes: input.notes?.trim() || null,
    })
    .eq("id", input.sessionId)
    .eq("status", "open")
    .select(
      "id, rep_id, business_date, channel, status, started_at, ended_at, break_minutes, notes",
    )
    .single();
  if (saved.error || !saved.data) {
    throw new Error(saved.error?.message ?? "Could not close Growth Hours.");
  }
  const rep = await supabase
    .from("sales_reps")
    .select("id, slug, display_name, role_title, benefit_profile")
    .eq("id", session.rep_id)
    .single();
  if (rep.error || !rep.data) throw new Error("Growth operator was not found.");
  const operator = toOperator(rep.data as SalesRepRow);
  return toSession(
    saved.data as GrowthWorkSessionRow,
    new Map([[operator.id, operator]]),
  );
}
