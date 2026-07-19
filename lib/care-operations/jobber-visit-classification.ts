import "server-only";

import { isMembershipAppointmentType } from "@/lib/membership/membership-appointment-types";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { readJobberCoverageSyncStatus } from "./jobber-coverage-store";
import { readJobberConnectionStatus } from "./jobber-connection-store";
import {
  loadJobberPropertyMatchingWorkspace,
  type SupervisedJobberVisitPreview,
} from "./jobber-property-matching";
import { assessJobberCompletionState } from "./jobber-visit-completion";

const AUTHORITATIVE_COMPLETION_GRAPHQL_VERSION = "2025-04-16";

const HASH_PATTERN = /^[0-9a-f]{64}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type VisitClassificationState =
  | "pending_review"
  | "approved"
  | "rejected"
  | "revoked";

interface StoredClassificationRow {
  id: string;
  projection_id: string;
  source_payload_hash: string;
  property_link_id: string;
  property_link_updated_at: string;
  membership_id: string;
  property_id: string;
  service_type: string;
  classification_state: VisitClassificationState;
  appointment_id: string | null;
  updated_at: string;
}

interface StoredAppointmentRow {
  id: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  completed_at: string | null;
  jobber_authority_state: string | null;
  source_payload_hash: string | null;
}

interface StoredCompletionRow {
  id: string;
  appointment_id: string;
  provider_completed_at: string;
}

export interface VisitClassificationPreview {
  classificationId: string;
  state: VisitClassificationState;
  serviceType: string;
  appointmentId: string | null;
  reviewedSourcePayloadHash: string;
  reviewedPropertyLinkId: string;
  reviewedPropertyLinkUpdatedAt: string;
  membershipId: string;
  propertyId: string;
  updatedAt: string;
}

export interface ClassifiableJobberVisit extends SupervisedJobberVisitPreview {
  classification: VisitClassificationPreview | null;
  appointment: {
    appointmentId: string;
    status: StoredAppointmentRow["status"];
    completedAt: string | null;
    authorityState: string | null;
    sourcePayloadHash: string | null;
  } | null;
  completion: {
    completionEventId: string;
    completedAt: string;
  } | null;
  promotionReadiness:
    | "ready_for_review"
    | "coverage_not_ready"
    | "property_link_required"
    | "provider_state_not_promotable";
  promotionBlockReason: string | null;
  completionReadiness:
    | "ready_for_confirmation"
    | "already_completed"
    | "coverage_not_ready"
    | "prior_approval_required"
    | "property_link_required"
    | "provider_state_not_complete";
  completionBlockReason: string | null;
}

export interface JobberVisitClassificationWorkspace {
  executionMode: "supervised_per_visit_classification";
  automaticClassification: false;
  obligationMatching: false;
  billingEnabled: false;
  visitLimitReached: boolean;
  coverage: {
    state: "complete" | "partial" | "stale";
    fresh: boolean;
    syncInProgress: boolean;
    decisionsEnabled: boolean;
    coveredAt: string | null;
    graphqlVersion: string | null;
    routeCompletenessClaimed: false;
  };
  visits: ClassifiableJobberVisit[];
}

export class VisitClassificationError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404 | 409 | 503,
  ) {
    super(message);
    this.name = "VisitClassificationError";
  }
}

export function assessVisitPromotion(input: {
  visitStatus: string;
  isComplete: boolean;
  completedAt: string | null;
  scheduledStart: string | null;
  now?: Date;
}): { promotable: boolean; reason: string | null } {
  if (input.visitStatus !== "UPCOMING") {
    return { promotable: false, reason: "Provider status is not UPCOMING." };
  }
  if (input.isComplete || input.completedAt !== null) {
    return { promotable: false, reason: "Completed visits are not promoted." };
  }
  if (!input.scheduledStart) {
    return { promotable: false, reason: "A scheduled start is required." };
  }
  const scheduledAt = Date.parse(input.scheduledStart);
  if (!Number.isFinite(scheduledAt)) {
    return { promotable: false, reason: "The scheduled start is malformed." };
  }
  if (scheduledAt <= (input.now ?? new Date()).getTime()) {
    return { promotable: false, reason: "Only future visits may be approved." };
  }
  return { promotable: true, reason: null };
}

function toClassificationPreview(
  row: StoredClassificationRow,
): VisitClassificationPreview {
  return {
    classificationId: row.id,
    state: row.classification_state,
    serviceType: row.service_type,
    appointmentId: row.appointment_id,
    reviewedSourcePayloadHash: row.source_payload_hash,
    reviewedPropertyLinkId: row.property_link_id,
    reviewedPropertyLinkUpdatedAt: row.property_link_updated_at,
    membershipId: row.membership_id,
    propertyId: row.property_id,
    updatedAt: row.updated_at,
  };
}

export async function loadJobberVisitClassificationWorkspace(
  now = new Date(),
): Promise<JobberVisitClassificationWorkspace> {
  const [matching, coverage, connection] = await Promise.all([
    loadJobberPropertyMatchingWorkspace(),
    readJobberCoverageSyncStatus(now),
    readJobberConnectionStatus(),
  ]);
  const projectionIds = matching.visits.map((visit) => visit.projectionId);
  const supabase = createServiceRoleSupabaseClient();
  const classificationResult = projectionIds.length
    ? await supabase
        .from("jobber_visit_classifications")
        .select(
          "id, projection_id, source_payload_hash, property_link_id, property_link_updated_at, membership_id, property_id, service_type, classification_state, appointment_id, updated_at",
        )
        .in("projection_id", projectionIds)
    : { data: [], error: null };
  if (classificationResult.error) {
    throw new Error(classificationResult.error.message);
  }
  const classificationByProjection = new Map(
    ((classificationResult.data ?? []) as StoredClassificationRow[]).map(
      (row) => [row.projection_id, toClassificationPreview(row)],
    ),
  );
  const appointmentIds = [...classificationByProjection.values()].flatMap(
    (classification) => classification.appointmentId
      ? [classification.appointmentId]
      : [],
  );
  const appointmentResult = appointmentIds.length
    ? await supabase
        .from("member_appointments")
        .select("id, status, completed_at, jobber_authority_state, source_payload_hash")
        .in("id", appointmentIds)
    : { data: [], error: null };
  if (appointmentResult.error) throw new Error(appointmentResult.error.message);
  const appointmentById = new Map(
    ((appointmentResult.data ?? []) as StoredAppointmentRow[]).map((row) => [row.id, row]),
  );
  const completionResult = appointmentIds.length
    ? await supabase
        .from("jobber_visit_completion_events")
        .select("id, appointment_id, provider_completed_at")
        .in("appointment_id", appointmentIds)
    : { data: [], error: null };
  if (completionResult.error) throw new Error(completionResult.error.message);
  const completionByAppointment = new Map(
    ((completionResult.data ?? []) as StoredCompletionRow[]).map((row) => [row.appointment_id, row]),
  );
  const decisionsEnabled =
    coverage.coverageState === "complete" &&
    coverage.fresh &&
    !coverage.syncInProgress &&
    connection.connected &&
    connection.status === "connected" &&
    connection.graphqlVersion === AUTHORITATIVE_COMPLETION_GRAPHQL_VERSION &&
    coverage.watermark?.graphqlVersion ===
      AUTHORITATIVE_COMPLETION_GRAPHQL_VERSION;

  return {
    executionMode: "supervised_per_visit_classification",
    automaticClassification: false,
    obligationMatching: false,
    billingEnabled: false,
    visitLimitReached: matching.visitLimitReached,
    coverage: {
      state: coverage.coverageState,
      fresh: coverage.fresh,
      syncInProgress: coverage.syncInProgress,
      decisionsEnabled,
      coveredAt: coverage.watermark?.coveredAt ?? null,
      graphqlVersion: coverage.watermark?.graphqlVersion ?? null,
      routeCompletenessClaimed: false,
    },
    visits: matching.visits.map((visit) => {
      const classification = classificationByProjection.get(visit.projectionId) ?? null;
      const appointmentRow = classification?.appointmentId
        ? appointmentById.get(classification.appointmentId) ?? null
        : null;
      const completionRow = appointmentRow
        ? completionByAppointment.get(appointmentRow.id) ?? null
        : null;
      const assessment = assessVisitPromotion({
        visitStatus: visit.visitStatus,
        isComplete: visit.isComplete,
        completedAt: visit.completedAt,
        scheduledStart: visit.scheduledStart,
        now,
      });
      const propertyReady =
        visit.propertyClassification === "homeatlas_member_property" &&
        visit.propertyLink?.linkState === "active" &&
        visit.propertyLink.membershipActive;
      const completionAssessment = assessJobberCompletionState({
        visitStatus: visit.visitStatus,
        isComplete: visit.isComplete,
        completedAt: visit.completedAt,
        sourceObservedAt: visit.sourceObservedAt,
        now,
      });
      const priorApprovalReady = Boolean(
        classification?.state === "pending_review" &&
        classification.appointmentId &&
        appointmentRow?.status === "scheduled" &&
        appointmentRow.jobber_authority_state === "pending_review" &&
        appointmentRow.source_payload_hash === classification.reviewedSourcePayloadHash &&
        classification.reviewedSourcePayloadHash !== visit.sourcePayloadHash &&
        visit.propertyLink?.linkId === classification.reviewedPropertyLinkId &&
        visit.propertyLink?.updatedAt === classification.reviewedPropertyLinkUpdatedAt &&
        visit.propertyLink?.membershipId === classification.membershipId &&
        visit.propertyLink?.propertyId === classification.propertyId
      );
      return {
        ...visit,
        classification,
        appointment: appointmentRow
          ? {
              appointmentId: appointmentRow.id,
              status: appointmentRow.status,
              completedAt: appointmentRow.completed_at,
              authorityState: appointmentRow.jobber_authority_state,
              sourcePayloadHash: appointmentRow.source_payload_hash,
            }
          : null,
        completion: completionRow
          ? {
              completionEventId: completionRow.id,
              completedAt: completionRow.provider_completed_at,
            }
          : null,
        promotionReadiness: !decisionsEnabled
          ? "coverage_not_ready"
          : !propertyReady
            ? "property_link_required"
            : assessment.promotable
              ? "ready_for_review"
              : "provider_state_not_promotable",
        promotionBlockReason: !decisionsEnabled
          ? "A current complete Jobber coverage watermark no older than 30 minutes is required, with no sync in progress."
          : !propertyReady
            ? "An active reviewed member-property link is required."
            : assessment.reason,
        completionReadiness: completionRow
          ? "already_completed"
          : !decisionsEnabled
            ? "coverage_not_ready"
            : !propertyReady
              ? "property_link_required"
              : !completionAssessment.confirmable
                ? "provider_state_not_complete"
                : priorApprovalReady
                  ? "ready_for_confirmation"
                  : "prior_approval_required",
        completionBlockReason: completionRow
          ? null
          : !decisionsEnabled
            ? "A current complete Jobber coverage watermark no older than 30 minutes is required, with no sync in progress."
            : !propertyReady
              ? "The exact reviewed property link and strictly active membership are required."
              : !completionAssessment.confirmable
                ? completionAssessment.reason
                : priorApprovalReady
                  ? null
                  : "The exact prior approved appointment and source-change evidence are required.",
      };
    }),
  };
}

interface ClassificationRpcResult {
  outcome: "approved" | "rejected" | "revoked" | "replay";
  classification_id: string;
  appointment_id: string | null;
}

function assertRpcResult(value: unknown): ClassificationRpcResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Visit classification transaction returned malformed data");
  }
  const row = value as Record<string, unknown>;
  if (
    !["approved", "rejected", "revoked", "replay"].includes(
      String(row.outcome),
    ) ||
    typeof row.classification_id !== "string" ||
    (row.appointment_id !== null && typeof row.appointment_id !== "string")
  ) {
    throw new Error("Visit classification transaction returned malformed data");
  }
  return row as unknown as ClassificationRpcResult;
}

function mapPersistenceError(error: { message: string }): never {
  if (error.message.includes("classification_invalid:")) {
    throw new VisitClassificationError(
      "The visit-classification request is invalid.",
      400,
    );
  }
  if (error.message.includes("classification_not_found:")) {
    throw new VisitClassificationError(
      "The reviewed Jobber record no longer exists.",
      404,
    );
  }
  if (error.message.includes("classification_conflict:")) {
    throw new VisitClassificationError(
      "The visit, property link, membership, or prior decision changed. Refresh before deciding.",
      409,
    );
  }
  throw new VisitClassificationError(
    "Visit classification storage is unavailable.",
    503,
  );
}

function assertDecisionInput(input: {
  projectionId: string;
  sourcePayloadHash: string;
  propertyLinkId: string;
  propertyLinkUpdatedAt: string;
  membershipId: string;
  propertyId: string;
  serviceType: string;
  reason: string;
  actorId: string;
}): void {
  if (
    !UUID_PATTERN.test(input.projectionId) ||
    !HASH_PATTERN.test(input.sourcePayloadHash) ||
    !UUID_PATTERN.test(input.propertyLinkId) ||
    !Number.isFinite(Date.parse(input.propertyLinkUpdatedAt)) ||
    !UUID_PATTERN.test(input.membershipId) ||
    !UUID_PATTERN.test(input.propertyId) ||
    !UUID_PATTERN.test(input.actorId) ||
    !isMembershipAppointmentType(input.serviceType) ||
    !input.reason.trim() ||
    input.reason.trim().length > 1000
  ) {
    throw new VisitClassificationError(
      "Refresh the visit and provide every reviewed decision field.",
      400,
    );
  }
}

export async function decideJobberVisitClassification(input: {
  action: "approve" | "reject";
  projectionId: string;
  sourcePayloadHash: string;
  propertyLinkId: string;
  propertyLinkUpdatedAt: string;
  membershipId: string;
  propertyId: string;
  serviceType: string;
  reason: string;
  actorId: string;
}): Promise<ClassificationRpcResult> {
  assertDecisionInput(input);
  const { data, error } = await createServiceRoleSupabaseClient().rpc(
    "decide_jobber_visit_classification",
    {
      requested_action: input.action,
      requested_projection_id: input.projectionId,
      requested_source_payload_hash: input.sourcePayloadHash,
      requested_property_link_id: input.propertyLinkId,
      requested_property_link_updated_at: input.propertyLinkUpdatedAt,
      requested_membership_id: input.membershipId,
      requested_property_id: input.propertyId,
      requested_service_type: input.serviceType,
      requested_reason: input.reason.trim(),
      requested_actor_id: input.actorId,
    },
  );
  if (error) mapPersistenceError(error);
  return assertRpcResult(data);
}

export async function revokeJobberVisitClassification(input: {
  classificationId: string;
  expectedUpdatedAt: string;
  reason: string;
  actorId: string;
}): Promise<ClassificationRpcResult> {
  if (
    !UUID_PATTERN.test(input.classificationId) ||
    !Number.isFinite(Date.parse(input.expectedUpdatedAt)) ||
    !UUID_PATTERN.test(input.actorId) ||
    !input.reason.trim() ||
    input.reason.trim().length > 1000
  ) {
    throw new VisitClassificationError(
      "Refresh the classification before revoking it.",
      400,
    );
  }
  const { data, error } = await createServiceRoleSupabaseClient().rpc(
    "revoke_jobber_visit_classification",
    {
      requested_classification_id: input.classificationId,
      requested_expected_updated_at: input.expectedUpdatedAt,
      requested_reason: input.reason.trim(),
      requested_actor_id: input.actorId,
    },
  );
  if (error) mapPersistenceError(error);
  return assertRpcResult(data);
}
