import "server-only";

import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";

const HASH_PATTERN = /^[0-9a-f]{64}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RFC3339_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/;

export class VisitCompletionError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404 | 409 | 503,
  ) {
    super(message);
    this.name = "VisitCompletionError";
  }
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function parseStrictProviderTimestamp(value: string | null): number | null {
  if (!value) return null;
  const match = RFC3339_TIMESTAMP.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[7] === "Z" ? 0 : Number(match[9]);
  const offsetMinute = match[7] === "Z" ? 0 : Number(match[10]);
  if (
    month < 1 || month > 12 ||
    day < 1 || day > daysInMonth(year, month) ||
    hour > 23 || minute > 59 || second > 59 ||
    offsetHour > 23 || offsetMinute > 59
  ) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function assessJobberCompletionState(input: {
  visitStatus: string;
  isComplete: boolean;
  completedAt: string | null;
  sourceObservedAt: string;
  now?: Date;
}): { confirmable: boolean; reason: string | null } {
  if (input.visitStatus !== "COMPLETED") {
    return { confirmable: false, reason: "Provider status is not COMPLETED." };
  }
  if (input.isComplete !== true) {
    return { confirmable: false, reason: "Provider completion flag is not true." };
  }
  const completedAt = parseStrictProviderTimestamp(input.completedAt);
  const observedAt = parseStrictProviderTimestamp(input.sourceObservedAt);
  const now = (input.now ?? new Date()).getTime();
  if (
    completedAt === null ||
    observedAt === null ||
    completedAt > observedAt ||
    completedAt > now
  ) {
    return {
      confirmable: false,
      reason: "Provider completion timestamp is missing, malformed, or contradictory.",
    };
  }
  return { confirmable: true, reason: null };
}

interface CompletionRpcResult {
  outcome: "completed" | "replay";
  appointment_id: string;
  completion_event_id: string;
  completed_at: string;
  actor_id: string;
}

interface EvidenceRpcResult {
  outcome: "recorded" | "replay";
  evidence_id: string;
  appointment_id: string;
  recorded_at: string;
}

function assertRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message);
  }
  return value as Record<string, unknown>;
}

function assertCompletionResult(value: unknown): CompletionRpcResult {
  const row = assertRecord(value, "Visit completion transaction returned malformed data");
  if (
    (row.outcome !== "completed" && row.outcome !== "replay") ||
    typeof row.appointment_id !== "string" ||
    typeof row.completion_event_id !== "string" ||
    typeof row.completed_at !== "string" ||
    typeof row.actor_id !== "string"
  ) {
    throw new Error("Visit completion transaction returned malformed data");
  }
  return row as unknown as CompletionRpcResult;
}

function assertEvidenceResult(value: unknown): EvidenceRpcResult {
  const row = assertRecord(value, "Visit evidence transaction returned malformed data");
  if (
    (row.outcome !== "recorded" && row.outcome !== "replay") ||
    typeof row.evidence_id !== "string" ||
    typeof row.appointment_id !== "string" ||
    typeof row.recorded_at !== "string"
  ) {
    throw new Error("Visit evidence transaction returned malformed data");
  }
  return row as unknown as EvidenceRpcResult;
}

function mapPersistenceError(error: { message: string }): never {
  if (
    error.message.includes("completion_invalid:") ||
    error.message.includes("visit_evidence_invalid:")
  ) {
    throw new VisitCompletionError("Refresh the visit and provide valid text evidence.", 400);
  }
  if (
    error.message.includes("completion_not_found:") ||
    error.message.includes("visit_evidence_not_found:")
  ) {
    throw new VisitCompletionError("The authoritative visit record no longer exists.", 404);
  }
  if (
    error.message.includes("completion_conflict:") ||
    error.message.includes("visit_evidence_conflict:")
  ) {
    throw new VisitCompletionError(
      "The visit source, prior approval, property link, membership, or completion state changed. Refresh before continuing.",
      409,
    );
  }
  throw new VisitCompletionError("Authoritative visit storage is unavailable.", 503);
}

export async function confirmJobberVisitCompletion(input: {
  appointmentId: string;
  projectionId: string;
  sourcePayloadHash: string;
  classificationId: string;
  classificationUpdatedAt: string;
  propertyLinkUpdatedAt: string;
  reason: string;
  actorId: string;
}): Promise<CompletionRpcResult> {
  if (
    !UUID_PATTERN.test(input.appointmentId) ||
    !UUID_PATTERN.test(input.projectionId) ||
    !HASH_PATTERN.test(input.sourcePayloadHash) ||
    !UUID_PATTERN.test(input.classificationId) ||
    parseStrictProviderTimestamp(input.classificationUpdatedAt) === null ||
    parseStrictProviderTimestamp(input.propertyLinkUpdatedAt) === null ||
    !UUID_PATTERN.test(input.actorId) ||
    !input.reason.trim() ||
    input.reason.trim().length > 1000
  ) {
    throw new VisitCompletionError("Refresh the exact visit before confirming completion.", 400);
  }

  const { data, error } = await createServiceRoleSupabaseClient().rpc(
    "confirm_jobber_visit_completion",
    {
      requested_appointment_id: input.appointmentId,
      requested_projection_id: input.projectionId,
      requested_source_payload_hash: input.sourcePayloadHash,
      requested_classification_id: input.classificationId,
      requested_classification_updated_at: input.classificationUpdatedAt,
      requested_property_link_updated_at: input.propertyLinkUpdatedAt,
      requested_reason: input.reason.trim(),
      requested_actor_id: input.actorId,
    },
  );
  if (error) mapPersistenceError(error);
  return assertCompletionResult(data);
}

export async function appendVisitTextEvidence(input: {
  evidenceId: string;
  appointmentId: string;
  evidenceText: string;
  actorId: string;
}): Promise<EvidenceRpcResult> {
  if (
    !UUID_PATTERN.test(input.evidenceId) ||
    !UUID_PATTERN.test(input.appointmentId) ||
    !UUID_PATTERN.test(input.actorId) ||
    !input.evidenceText.trim() ||
    input.evidenceText.trim().length > 4000
  ) {
    throw new VisitCompletionError("Provide valid text evidence for the completed visit.", 400);
  }

  const { data, error } = await createServiceRoleSupabaseClient().rpc(
    "append_visit_text_evidence",
    {
      requested_evidence_id: input.evidenceId,
      requested_appointment_id: input.appointmentId,
      requested_evidence_text: input.evidenceText.trim(),
      requested_actor_id: input.actorId,
    },
  );
  if (error) mapPersistenceError(error);
  return assertEvidenceResult(data);
}
