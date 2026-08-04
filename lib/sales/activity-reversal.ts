import type { SalesActivityType } from "./workspace-types";

export const SALES_ACTIVITY_UNDO_WINDOW_MS = 10 * 60 * 1000;

export const REVERSIBLE_SALES_ACTIVITY_TYPES = [
  "door_knock",
  "conversation",
  "presentation_started",
  "membership_signed",
] as const satisfies readonly SalesActivityType[];

export interface SalesActivityReversalCandidate {
  eventType: SalesActivityType;
  leadId: string | null;
  occurredAt: string;
  reversedAt: string | null;
}

export function isReversibleSalesActivityType(
  eventType: SalesActivityType,
): eventType is (typeof REVERSIBLE_SALES_ACTIVITY_TYPES)[number] {
  return REVERSIBLE_SALES_ACTIVITY_TYPES.some(
    (reversibleType) => reversibleType === eventType,
  );
}

export function getSalesActivityUndoExpiresAt(
  occurredAt: string,
): string | null {
  const occurredAtMs = Date.parse(occurredAt);
  if (!Number.isFinite(occurredAtMs)) return null;
  return new Date(occurredAtMs + SALES_ACTIVITY_UNDO_WINDOW_MS).toISOString();
}

export function isSalesActivityUndoAvailable(
  candidate: SalesActivityReversalCandidate,
  referenceDate = new Date(),
): boolean {
  if (
    candidate.leadId !== null ||
    candidate.reversedAt !== null ||
    !isReversibleSalesActivityType(candidate.eventType)
  ) {
    return false;
  }

  const occurredAtMs = Date.parse(candidate.occurredAt);
  const referenceTimeMs = referenceDate.getTime();
  if (!Number.isFinite(occurredAtMs) || !Number.isFinite(referenceTimeMs)) {
    return false;
  }

  // A small allowance avoids rejecting a just-created event when the app and
  // database clocks differ by a few seconds.
  const ageMs = referenceTimeMs - occurredAtMs;
  return ageMs >= -60_000 && ageMs <= SALES_ACTIVITY_UNDO_WINDOW_MS;
}
