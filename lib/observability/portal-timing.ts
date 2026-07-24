import "server-only";

const PORTAL_TIMING_OPERATIONS = [
  "portal-manifest",
  "portal-page-load",
  "portal-token-access",
] as const;

const PORTAL_TIMING_OUTCOMES = [
  "success",
  "not-found",
  "error",
  "skipped",
] as const;

export type PortalTimingOperation = (typeof PORTAL_TIMING_OPERATIONS)[number];
export type PortalTimingOutcome = (typeof PORTAL_TIMING_OUTCOMES)[number];

interface PortalTimingHandle {
  finish: (outcome: PortalTimingOutcome) => void;
}

function includes<T extends string>(values: readonly T[], value: string): value is T {
  return values.includes(value as T);
}

/**
 * Records only an allowlisted operation, outcome, and elapsed milliseconds.
 * There is intentionally no metadata parameter: portal credentials and
 * customer/property identifiers must never enter timing logs.
 */
export function startPortalTiming(
  operation: PortalTimingOperation,
): PortalTimingHandle {
  if (!includes(PORTAL_TIMING_OPERATIONS, operation)) {
    throw new Error("Unsupported portal timing operation");
  }

  const startedAt = Date.now();
  let finished = false;

  return {
    finish(outcome) {
      if (finished) return;
      if (!includes(PORTAL_TIMING_OUTCOMES, outcome)) {
        throw new Error("Unsupported portal timing outcome");
      }

      finished = true;
      console.info("[portal-timing]", {
        operation,
        outcome,
        durationMs: Math.max(0, Date.now() - startedAt),
      });
    },
  };
}
