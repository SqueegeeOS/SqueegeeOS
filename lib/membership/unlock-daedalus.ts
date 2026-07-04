/**
 * Unlock Ceremony — Daedalus Motion Spec v1
 *
 * Phase 1 — Approach     0ms → 800ms
 * Phase 2 — Insert       800ms → 1200ms  (micro-pause at 1050ms)
 * Phase 3 — Turn         1200ms → 1800ms  (cylinder lag 120ms, bounce at 1500ms)
 * Phase 4 — Release      1800ms → 2400ms
 * Phase 5 — Bloom        2400ms → 3200ms  (lock fade 600ms, 400ms hold)
 * Phase 6 — Reveal       3200ms → 4000ms  (portal handoff + card stagger)
 */

export type DaedalusCeremonyPhase =
  | "fade"
  | "approach"
  | "insert"
  | "turn"
  | "release"
  | "bloom"
  | "reveal";

/** Luxury deceleration — weighted approach */
export const EASE_WEIGHTED = [0.16, 1, 0.3, 1] as const;

/** Deliberate mechanical turn */
export const EASE_MECHANICAL = [0.4, 0, 0.2, 1] as const;

/** Physical shackle snap */
export const EASE_SNAP = [0.34, 1.56, 0.64, 1] as const;

export const DAEDALUS_WARM_LIGHT = "#FFF5E0";

export const DAEDALUS_PHASE_MS = {
  fade: 0,
  approach: 800,
  insert: 400,
  /** Ms into insert phase when key pauses (absolute 1050ms − 800ms) */
  insertPauseOffset: 250,
  insertPauseDuration: 80,
  turn: 600,
  cylinderLag: 120,
  /** Ms into turn when tension bounce fires (absolute 1500ms − 1200ms) */
  turnBounceOffset: 300,
  turnBounceDegrees: 2,
  release: 600,
  bloom: 800,
  lockFadeDuration: 600,
  bloomHold: 400,
  reveal: 800,
  portalCardStagger: 80,
  skipAvailableAfter: 800,
} as const;

export const DAEDALUS_TOTAL_MS =
  DAEDALUS_PHASE_MS.approach +
  DAEDALUS_PHASE_MS.insert +
  DAEDALUS_PHASE_MS.turn +
  DAEDALUS_PHASE_MS.release +
  DAEDALUS_PHASE_MS.bloom +
  DAEDALUS_PHASE_MS.reveal;

/** Fast profile — same choreography, ~55% duration */
export function scaleDaedalusPhases(scale: number) {
  const s = (ms: number) => Math.round(ms * scale);
  return {
    fade: 0,
    approach: s(DAEDALUS_PHASE_MS.approach),
    insert: s(DAEDALUS_PHASE_MS.insert),
    insertPauseOffset: s(DAEDALUS_PHASE_MS.insertPauseOffset),
    insertPauseDuration: s(DAEDALUS_PHASE_MS.insertPauseDuration),
    turn: s(DAEDALUS_PHASE_MS.turn),
    cylinderLag: s(DAEDALUS_PHASE_MS.cylinderLag),
    turnBounceOffset: s(DAEDALUS_PHASE_MS.turnBounceOffset),
    turnBounceDegrees: DAEDALUS_PHASE_MS.turnBounceDegrees,
    release: s(DAEDALUS_PHASE_MS.release),
    bloom: s(DAEDALUS_PHASE_MS.bloom),
    lockFadeDuration: s(DAEDALUS_PHASE_MS.lockFadeDuration),
    bloomHold: s(DAEDALUS_PHASE_MS.bloomHold),
    reveal: s(DAEDALUS_PHASE_MS.reveal),
    portalCardStagger: s(DAEDALUS_PHASE_MS.portalCardStagger),
    skipAvailableAfter: s(DAEDALUS_PHASE_MS.skipAvailableAfter),
  };
}

export type DaedalusPhaseMs = ReturnType<typeof scaleDaedalusPhases>;

export function getDaedalusPhaseMs(profile: "full" | "fast"): DaedalusPhaseMs {
  return profile === "fast" ? scaleDaedalusPhases(0.55) : { ...DAEDALUS_PHASE_MS };
}

export function getDaedalusTotalMs(profile: "full" | "fast"): number {
  const p = getDaedalusPhaseMs(profile);
  return p.approach + p.insert + p.turn + p.release + p.bloom + p.reveal;
}
