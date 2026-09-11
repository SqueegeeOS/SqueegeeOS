import "server-only";
import { canTechnicianViewJobValue, fieldJobValue } from "./field-job-value";

import {
  COMPANY_BUSINESS_TIMEZONE,
  getBusinessCalendarDayUtcBounds,
} from "@/lib/admin/company-business-timezone";
import { JOBBER_CONNECTION_ID } from "@/lib/care-operations/jobber-oauth-config";
import { formatJobberVisitAddress } from "@/lib/care-operations/jobber-visit-address";
import {
  readJobberTodayVisitScope,
  type JobberTodayVisit,
} from "@/lib/care-operations/jobber-today-types";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import type { FieldActor } from "./field-access";
import { homeAtlasTechnicianId } from "./field-access";
import {
  EMPTY_TECHNICIAN_JOB_CLOCK,
} from "./technician-job-clock";
import {
  loadHomeAtlasFieldExecution,
} from "./homeatlas-field-assignment-server";
import {
  chooseLiveDispatchReconciliationCandidate,
  liveDispatchServiceScope,
  validateCreateLiveDispatchJobInput,
  type CreateLiveDispatchJobInput,
  type LiveDispatchReconciliationCandidate,
  type LiveDispatchReconciliationSource,
} from "./live-dispatch";

interface LiveAssignmentRow {
  live_sold_amount_cents?: number | null;
  id: string;
  external_visit_id: string;
  technician_id: string;
  technician_display_name: string;
  source_kind: "jobber" | "live";
  sync_state: "pending_sync" | "verified";
  live_client_name: string | null;
  live_service_title: string | null;
  live_property_address: string | null;
  live_scheduled_start: string | null;
  live_service_scope: unknown;
  assigned_at: string;
}

interface ProjectionRow {
  id: string;
  external_visit_id: string;
  client_name: string;
  title: string | null;
  property_address: unknown;
  scheduled_start: string;
  visit_status: string;
}

export interface CreatedLiveDispatchJob {
  assignmentId: string;
  technicianId: string;
  technicianDisplayName: string;
  externalVisitId: string;
  scheduledStart: string;
  syncState: "pending_sync";
  replayed: boolean;
}

export async function createLiveDispatchJob(
  input: CreateLiveDispatchJobInput,
): Promise<CreatedLiveDispatchJob> {
  const validationError = validateCreateLiveDispatchJobInput(input);
  if (validationError) throw new Error(validationError);

  const result = await createServiceRoleSupabaseClient()
    .rpc("create_live_homeatlas_technician_job", {
      p_client_request_id: input.clientRequestId,
      p_technician_id: input.technicianId,
      p_scheduled_start: input.scheduledStart,
      p_client_name: input.clientName.trim(),
      p_service_title: input.serviceTitle.trim(),
      p_property_address: input.propertyAddress?.trim() || null,
      p_sold_amount_cents: input.soldAmountCents ?? null,
      p_notes: input.notes?.trim() || null,
      p_actor: "HomeAtlas HQ",
    })
    .single();

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Could not create the live field job.");
  }
  const row = result.data as {
    assignment_id: string;
    technician_id: string;
    technician_display_name: string;
    external_visit_id: string;
    scheduled_start: string;
    replayed: boolean;
  };
  return {
    assignmentId: row.assignment_id,
    technicianId: row.technician_id,
    technicianDisplayName: row.technician_display_name,
    externalVisitId: row.external_visit_id,
    scheduledStart: row.scheduled_start,
    syncState: "pending_sync",
    replayed: Boolean(row.replayed),
  };
}

function reconciliationWindow(reference: Date): { from: string; to: string } {
  return {
    from: new Date(reference.getTime() - 2 * 24 * 60 * 60 * 1_000).toISOString(),
    to: new Date(reference.getTime() + 2 * 24 * 60 * 60 * 1_000).toISOString(),
  };
}

/**
 * Attach pending HomeAtlas-live jobs to Jobber only when one strong candidate is
 * visible. Ambiguous candidates intentionally stay pending instead of guessing.
 */
export async function reconcilePendingLiveDispatchJobs(
  reference: Date = new Date(),
): Promise<{ reconciled: number; warnings: string[] }> {
  const supabase = createServiceRoleSupabaseClient();
  const window = reconciliationWindow(reference);
  const pending = await supabase
    .from("homeatlas_technician_visit_assignments")
    .select(
      "id, external_visit_id, technician_id, technician_display_name, source_kind, sync_state, live_client_name, live_service_title, live_property_address, live_scheduled_start, live_service_scope, assigned_at",
    )
    .eq("source_kind", "live")
    .eq("sync_state", "pending_sync")
    .gte("live_scheduled_start", window.from)
    .lte("live_scheduled_start", window.to)
    .order("live_scheduled_start", { ascending: true })
    .limit(500);
  if (pending.error) {
    return {
      reconciled: 0,
      warnings: ["Live jobs could not be checked against Jobber yet."],
    };
  }
  const pendingRows = (pending.data ?? []) as LiveAssignmentRow[];
  if (!pendingRows.length) return { reconciled: 0, warnings: [] };

  const projectionResult = await supabase
    .from("jobber_visit_projections")
    .select(
      "id, external_visit_id, client_name, title, property_address, scheduled_start, visit_status",
    )
    .eq("connection_id", JOBBER_CONNECTION_ID)
    .neq("visit_status", "REMOVED")
    .gte("scheduled_start", window.from)
    .lte("scheduled_start", window.to)
    .order("scheduled_start", { ascending: true })
    .limit(5_000);
  if (projectionResult.error) {
    return {
      reconciled: 0,
      warnings: ["Jobber is still behind, so live jobs remain pending sync."],
    };
  }
  const projections = (projectionResult.data ?? []) as ProjectionRow[];
  if (!projections.length) return { reconciled: 0, warnings: [] };

  const projectionIds = projections.map((row) => row.id);
  const linkedResult = await supabase
    .from("homeatlas_technician_visit_assignments")
    .select("projection_id")
    .in("projection_id", projectionIds)
    .limit(5_000);
  if (linkedResult.error) {
    return {
      reconciled: 0,
      warnings: ["Live jobs could not safely verify existing Jobber links."],
    };
  }
  const alreadyLinked = new Set(
    (linkedResult.data ?? []).flatMap((row) =>
      typeof row.projection_id === "string" ? [row.projection_id] : [],
    ),
  );

  const availableCandidates: LiveDispatchReconciliationCandidate[] = projections
    .filter((row) => !alreadyLinked.has(row.id))
    .map((row) => ({
      projectionId: row.id,
      clientName: row.client_name,
      title: row.title,
      propertyAddress: formatJobberVisitAddress(row.property_address),
      scheduledStart: row.scheduled_start,
    }));

  let reconciled = 0;
  const warnings: string[] = [];
  for (const row of pendingRows) {
    if (!row.live_client_name || !row.live_service_title || !row.live_scheduled_start) {
      continue;
    }
    const source: LiveDispatchReconciliationSource = {
      assignmentId: row.id,
      clientName: row.live_client_name,
      serviceTitle: row.live_service_title,
      propertyAddress: row.live_property_address,
      scheduledStart: row.live_scheduled_start,
    };
    const candidate = chooseLiveDispatchReconciliationCandidate(
      source,
      availableCandidates,
    );
    if (!candidate) continue;
    const result = await supabase
      .rpc("reconcile_live_homeatlas_technician_job", {
        p_assignment_id: row.id,
        p_projection_id: candidate.projectionId,
        p_actor: "HomeAtlas automatic reconciliation",
      })
      .single();
    if (result.error || !result.data) {
      warnings.push(
        `A live job for ${row.live_client_name} found Jobber but could not link safely.`,
      );
      continue;
    }
    reconciled += 1;
    alreadyLinked.add(candidate.projectionId);
    const index = availableCandidates.findIndex(
      (item) => item.projectionId === candidate.projectionId,
    );
    if (index >= 0) availableCandidates.splice(index, 1);
  }
  return { reconciled, warnings };
}

function nativeFieldStage(
  execution: Awaited<ReturnType<typeof loadHomeAtlasFieldExecution>>["byAssignmentId"] extends Map<string, infer T>
    ? T
    : never,
): JobberTodayVisit["homeAtlasFieldStage"] {
  if (execution.clock.state === "finished") return "departed";
  if (execution.fieldRecordCount > 0) return "service_completed";
  if (execution.clock.state === "running") return "service_started";
  return "not_started";
}

export async function loadPendingLiveFieldVisits(
  actor: FieldActor,
  reference: Date = new Date(),
): Promise<JobberTodayVisit[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { startUtc, endUtc } = getBusinessCalendarDayUtcBounds(
    reference,
    COMPANY_BUSINESS_TIMEZONE,
  );
  let query = supabase
    .from("homeatlas_technician_visit_assignments")
    .select(
      "id, external_visit_id, technician_id, technician_display_name, source_kind, sync_state, live_client_name, live_service_title, live_property_address, live_scheduled_start, live_service_scope, live_sold_amount_cents, assigned_at",
    )
    .eq("source_kind", "live")
    .eq("sync_state", "pending_sync")
    .gte("live_scheduled_start", startUtc.toISOString())
    .lt("live_scheduled_start", endUtc.toISOString())
    .order("live_scheduled_start", { ascending: true })
    .limit(500);

  if (actor.kind === "technician") {
    const technicianId = homeAtlasTechnicianId(actor.jobberUserId);
    if (!technicianId) return [];
    query = query.eq("technician_id", technicianId);
  }

  const result = await query;
  if (result.error) throw new Error("Live dispatch jobs could not load.");
  const rows = (result.data ?? []) as LiveAssignmentRow[];
  if (!rows.length) return [];

  const execution = await loadHomeAtlasFieldExecution(rows.map((row) => row.id));
  if (!execution.available) {
    throw new Error("Live dispatch field execution is not ready yet.");
  }

  return rows.flatMap((row) => {
    if (!row.live_client_name || !row.live_service_title || !row.live_scheduled_start) {
      return [];
    }
    const fieldExecution = execution.byAssignmentId.get(row.id) ?? {
      clock: EMPTY_TECHNICIAN_JOB_CLOCK,
      fieldRecordCount: 0,
      latestFieldRecordAt: null,
      latestFieldRecordBy: null,
      customerVisibleRecordCount: 0,
      openFollowUpCount: 0,
      customerSummary: null,
      internalNote: null,
      scopeException: null,
      photoCount: 0,
    };
    const scope = readJobberTodayVisitScope({
      scopeItems: Array.isArray(row.live_service_scope)
        ? row.live_service_scope
        : liveDispatchServiceScope(row.id, row.live_service_title),
    });
    const stage = nativeFieldStage(fieldExecution);
    const stageAt =
      fieldExecution.clock.endedAt ??
      fieldExecution.latestFieldRecordAt ??
      fieldExecution.clock.startedAt ??
      null;
    const stageBy =
      fieldExecution.clock.finishedByDisplayName ??
      fieldExecution.latestFieldRecordBy ??
      fieldExecution.clock.startedByDisplayName ??
      null;
    return [
      {
        projectionId: `live:${row.id}`,
        jobValue: actor.kind === "admin" || canTechnicianViewJobValue(actor.jobberUserId)
          ? fieldJobValue(row.live_sold_amount_cents, "hq") : undefined,
        externalVisitId: row.external_visit_id,
        clientName: row.live_client_name,
        title: row.live_service_title,
        jobNumber: null,
        visitStatus: "HOMEATLAS_LIVE",
        jobStatus: "PENDING_JOBBER_SYNC",
        scheduledStart: row.live_scheduled_start,
        scheduledEnd: null,
        isComplete: fieldExecution.clock.state === "finished",
        assignedUsers: [],
        assignmentReadState: "available",
        scopeItems: scope.scopeItems,
        scopeReadState: scope.scopeReadState,
        propertyLabel: "Live dispatch · Jobber sync pending",
        propertyAddress: row.live_property_address,
        jobberInvoiceStatus: null,
        jobberPropertyWebUri: null,
        jobberClientWebUri: null,
        homeAtlasPropertyId: null,
        homeAtlasAppointmentId: null,
        homeAtlasFieldAssignmentId: row.id,
        homeAtlasAssignedTechnicianId: `homeatlas:${row.technician_id}`,
        homeAtlasAssignedTechnicianName: row.technician_display_name,
        homeAtlasMembershipId: null,
        homeAtlasPortalPath: null,
        homeAtlasFieldRecordCount: fieldExecution.fieldRecordCount,
        homeAtlasLatestFieldRecordAt: fieldExecution.latestFieldRecordAt,
        homeAtlasLatestFieldRecordBy: fieldExecution.latestFieldRecordBy,
        homeAtlasCustomerVisibleRecordCount: 0,
        homeAtlasOpenFollowUpCount: fieldExecution.openFollowUpCount,
        homeAtlasFieldCustomerSummary: fieldExecution.customerSummary,
        homeAtlasFieldInternalNote: fieldExecution.internalNote,
        homeAtlasFieldScopeException: fieldExecution.scopeException,
        homeAtlasFieldPhotoCount: fieldExecution.photoCount,
        homeAtlasFieldStage: stage,
        homeAtlasFieldStageAt: stageAt,
        homeAtlasFieldStageBy: stageBy,
        homeAtlasFieldEventCount: 0,
        homeAtlasJobClock: fieldExecution.clock,
        homeAtlasIndependenceReview: null,
      } satisfies JobberTodayVisit,
    ];
  });
}
