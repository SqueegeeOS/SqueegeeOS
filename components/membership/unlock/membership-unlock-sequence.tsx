"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DAEDALUS_WARM_LIGHT,
  EASE_WEIGHTED,
  getDaedalusPhaseMs,
  getDaedalusTotalMs,
  type DaedalusCeremonyPhase,
} from "@/lib/membership/unlock-daedalus";
import {
  markMemberWelcomePending,
  type MembershipUnlockContext,
  type UnlockTimingProfile,
} from "@/lib/membership/unlock-sequence";
import { playLockClickSound } from "@/lib/membership/unlock-sound";
import { ChromePadlock } from "./chrome-padlock";
import { CrownKey } from "./crown-key";

interface MembershipUnlockSequenceProps {
  context: MembershipUnlockContext;
  timingProfile: UnlockTimingProfile;
  onComplete: () => void;
  /** Lab preview — skips session/localStorage side effects */
  previewMode?: boolean;
}

export function MembershipUnlockSequence({
  context,
  timingProfile,
  onComplete,
  previewMode = false,
}: MembershipUnlockSequenceProps) {
  const [phase, setPhase] = useState<DaedalusCeremonyPhase>("approach");
  const [showSkip, setShowSkip] = useState(false);
  const [liteEffects, setLiteEffects] = useState(false);
  const completedRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const reduceMotionRef = useRef(false);

  const phaseMs = getDaedalusPhaseMs(timingProfile);

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    timersRef.current.forEach(clearTimeout);
    if (!previewMode) {
      markMemberWelcomePending();
    }
    onComplete();
  }, [onComplete, previewMode]);

  const skipToPortal = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    if (completedRef.current) return;
    completedRef.current = true;
    if (!previewMode) {
      markMemberWelcomePending();
    }
    onComplete();
  }, [onComplete, previewMode]);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
  }, []);

  useEffect(() => {
    const isReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches;

    reduceMotionRef.current = isReduced;
    setLiteEffects(isMobile);

    if (isReduced) {
      if (!previewMode) {
        markMemberWelcomePending();
      }
      schedule(finish, 400);
      return () => timersRef.current.forEach(clearTimeout);
    }

    let elapsed = 0;

    const chain = (next: DaedalusCeremonyPhase, ms: number) => {
      schedule(() => setPhase(next), elapsed);
      elapsed += ms;
    };

    // Phase 1 — Approach (0 → 800ms)
    chain("insert", phaseMs.approach);

    // Phase 2 — Insert (800 → 1200ms); click after micro-resistance
    schedule(
      () => playLockClickSound(),
      phaseMs.approach +
        phaseMs.insertPauseOffset +
        phaseMs.insertPauseDuration,
    );
    chain("turn", phaseMs.insert);

    // Phase 3 — Turn (1200 → 1800ms)
    chain("release", phaseMs.turn);

    // Phase 4 — Release (1800 → 2400ms)
    chain("bloom", phaseMs.release);

    // Phase 5 — Bloom (2400 → 3200ms)
    chain("reveal", phaseMs.bloom);

    // Phase 6 — Reveal (3200 → 4000ms) → portal handoff
    schedule(finish, elapsed + phaseMs.reveal);

    schedule(() => setShowSkip(true), phaseMs.skipAvailableAfter);

    return () => timersRef.current.forEach(clearTimeout);
  }, [finish, phaseMs, previewMode, schedule]);

  const showBloom =
    phase === "release" || phase === "bloom" || phase === "reveal";
  const bloomFull = phase === "bloom" || phase === "reveal";
  const handoff = phase === "reveal";

  return (
    <div
      className="fixed inset-0 z-[250] overflow-hidden bg-[#020202]"
      role="dialog"
      aria-modal="true"
      aria-label="Membership welcome ceremony"
    >
      {showSkip && phase !== "reveal" && (
        <motion.button
          type="button"
          onClick={skipToPortal}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE_WEIGHTED }}
          className="absolute right-4 top-[max(0.75rem,env(safe-area-inset-top))] z-50 flex min-h-[48px] items-center gap-2 rounded-full border border-white/30 bg-black/70 px-5 py-2.5 text-xs font-medium uppercase tracking-[0.16em] text-white shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md touch-manipulation hover:border-white/50 hover:bg-black/80 sm:right-6"
        >
          Skip to portal
          <span aria-hidden className="text-white/60">
            →
          </span>
        </motion.button>
      )}

      {/* Lock + key choreography */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center will-change-transform"
        animate={{ opacity: handoff ? 0 : 1 }}
        transition={{ duration: phaseMs.reveal / 1000, ease: EASE_WEIGHTED }}
      >
        {!liteEffects && (
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              background:
                "radial-gradient(ellipse at 50% 42%, rgba(255,245,230,0.06) 0%, transparent 58%)",
            }}
          />
        )}

        <div className="relative flex flex-col items-center justify-center">
          <div className="relative">
            <ChromePadlock
              phase={phase}
              phaseMs={phaseMs}
              liteMode={liteEffects}
              className="h-40 w-auto sm:h-52 md:h-60"
            />
            <div className="absolute left-1/2 top-[58%] -translate-x-1/2">
              <CrownKey phase={phase} phaseMs={phaseMs} className="h-24 w-auto sm:h-28" />
            </div>
          </div>
        </div>

        {/* Phase 4–5 — warm radial light from lock → edge-to-edge bloom */}
        {showBloom && (
          <motion.div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: phaseMs.release / 1000, ease: EASE_WEIGHTED }}
          >
            <motion.div
              className="rounded-full will-change-[transform,opacity]"
              initial={{ opacity: 0, scale: 0.35 }}
              animate={{
                opacity: phase === "release" ? 0.3 : bloomFull ? 0.85 : 0.3,
                scale: bloomFull ? (liteEffects ? 3.2 : 4.6) : liteEffects ? 1.6 : 2.2,
              }}
              transition={{
                duration:
                  phase === "release"
                    ? phaseMs.release / 1000
                    : phaseMs.bloom / 1000,
                ease: EASE_WEIGHTED,
              }}
              style={{
                width: "min(90vw, 480px)",
                height: "min(90vw, 480px)",
                background: `radial-gradient(circle, ${DAEDALUS_WARM_LIGHT} 0%, rgba(255,245,224,0.45) 28%, rgba(255,240,215,0.12) 52%, transparent 72%)`,
              }}
            />
          </motion.div>
        )}
      </motion.div>

      {/* Phase 5 hold + Phase 6 reveal — warm fill hands off to portal stagger */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundColor: DAEDALUS_WARM_LIGHT }}
        initial={{ opacity: 0 }}
        animate={{ opacity: bloomFull ? (handoff ? 0 : 0.92) : 0 }}
        transition={{
          duration: handoff
            ? phaseMs.reveal / 1000
            : phaseMs.bloom / 1000,
          ease: EASE_WEIGHTED,
        }}
        aria-hidden
      />

      <span className="sr-only">
        Membership unlock ceremony for {context.propertyName}. Portal loading.
      </span>
    </div>
  );
}

/** Total ceremony duration in ms (Daedalus v1) */
export function getCeremonyDurationMs(profile: UnlockTimingProfile): number {
  return getDaedalusTotalMs(profile);
}
