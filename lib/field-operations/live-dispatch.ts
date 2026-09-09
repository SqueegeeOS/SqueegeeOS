import type { JobberTodayScopeItem } from "@/lib/care-operations/jobber-today-types";

export const LIVE_DISPATCH_EXTERNAL_PREFIX = "homeatlas-live:";
export const LIVE_DISPATCH_MATCH_WINDOW_MS = 12 * 60 * 60 * 1_000;

export type LiveDispatchSyncState = "pending_sync" | "verified";

export interface CreateLiveDispatchJobInput {
  clientRequestId: string;
  technicianId: string;
  scheduledStart: string;
  clientName: string;
  serviceTitle: string;
  propertyAddress?: string;
  soldAmountCents?: number | null;
  notes?: string;
}

export interface LiveDispatchReconciliationSource {
  assignmentId: string;
  clientName: string;
  serviceTitle: string;
  propertyAddress: string | null;
  scheduledStart: string;
}

export interface LiveDispatchReconciliationCandidate {
  projectionId: string;
  clientName: string;
  title: string | null;
  propertyAddress: string | null;
  scheduledStart: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isLiveDispatchExternalVisitId(value: unknown): value is string {
  return (
    typeof value === "string" && value.startsWith(LIVE_DISPATCH_EXTERNAL_PREFIX)
  );
}

export function normalizeLiveDispatchText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function validateCreateLiveDispatchJobInput(
  value: unknown,
): string | null {
  if (!value || typeof value !== "object") {
    return "Enter a valid live dispatch job.";
  }
  const input = value as Partial<CreateLiveDispatchJobInput>;
  if (!UUID_PATTERN.test(input.clientRequestId ?? "")) {
    return "Create a valid live dispatch request.";
  }
  if (!UUID_PATTERN.test(input.technicianId ?? "")) {
    return "Choose a valid HomeAtlas technician.";
  }
  const scheduledAt = Date.parse(input.scheduledStart ?? "");
  if (!Number.isFinite(scheduledAt)) {
    return "Choose a valid service time.";
  }
  const clientName = input.clientName?.trim() ?? "";
  if (clientName.length < 2 || clientName.length > 120) {
    return "Client name must be between 2 and 120 characters.";
  }
  const serviceTitle = input.serviceTitle?.trim() ?? "";
  if (serviceTitle.length < 2 || serviceTitle.length > 160) {
    return "Service must be between 2 and 160 characters.";
  }
  if ((input.propertyAddress ?? "").trim().length > 320) {
    return "Address must be 320 characters or fewer.";
  }
  if ((input.notes ?? "").trim().length > 1_000) {
    return "Dispatch notes must be 1,000 characters or fewer.";
  }
  if (
    input.soldAmountCents != null &&
    (!Number.isInteger(input.soldAmountCents) ||
      input.soldAmountCents < 0 ||
      input.soldAmountCents > 100_000_000)
  ) {
    return "Sold amount must be a valid non-negative dollar amount.";
  }
  return null;
}

export function liveDispatchServiceScope(
  assignmentId: string,
  serviceTitle: string,
): JobberTodayScopeItem[] {
  return [
    {
      id: `live-service:${assignmentId}`,
      name: serviceTitle.trim(),
      description: null,
      quantity: 1,
      category: "Live dispatch",
    },
  ];
}

function isCandidateMatch(
  source: LiveDispatchReconciliationSource,
  candidate: LiveDispatchReconciliationCandidate,
): boolean {
  if (
    normalizeLiveDispatchText(source.clientName) !==
    normalizeLiveDispatchText(candidate.clientName)
  ) {
    return false;
  }
  const sourceTime = Date.parse(source.scheduledStart);
  const candidateTime = Date.parse(candidate.scheduledStart);
  if (
    !Number.isFinite(sourceTime) ||
    !Number.isFinite(candidateTime) ||
    Math.abs(sourceTime - candidateTime) > LIVE_DISPATCH_MATCH_WINDOW_MS
  ) {
    return false;
  }

  const sourceAddress = normalizeLiveDispatchText(source.propertyAddress);
  const candidateAddress = normalizeLiveDispatchText(candidate.propertyAddress);
  if (sourceAddress) {
    return Boolean(candidateAddress) && sourceAddress === candidateAddress;
  }

  const sourceTitle = normalizeLiveDispatchText(source.serviceTitle);
  const candidateTitle = normalizeLiveDispatchText(candidate.title);
  return Boolean(sourceTitle && candidateTitle && sourceTitle === candidateTitle);
}

/**
 * Automatic reconciliation is deliberately conservative. A live job only
 * attaches to Jobber when exactly one mirrored visit is a strong match.
 */
export function chooseLiveDispatchReconciliationCandidate(
  source: LiveDispatchReconciliationSource,
  candidates: LiveDispatchReconciliationCandidate[],
): LiveDispatchReconciliationCandidate | null {
  const matches = candidates.filter((candidate) =>
    isCandidateMatch(source, candidate),
  );
  return matches.length === 1 ? matches[0]! : null;
}
