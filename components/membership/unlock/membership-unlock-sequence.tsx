"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getUnlockTiming,
  markMemberWelcomePending,
  UNLOCK_WELCOME_COPY,
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
}

const easeCinematic = [0.22, 1, 0.36, 1] as const;
const easeSlow = [0.16, 1, 0.3, 1] as const;
const easeBloom = [0.12, 0.8, 0.22, 1] as const;

type CeremonyPhase =
  | "fade"
  | "lock"
  | "keyApproach"
  | "keyTurn"
  | "unlock"
  | "bloom"
  | "welcomeOne"
  | "welcomeBreath"
  | "welcomeTwo"
  | "exit";

export function MembershipUnlockSequence({
  context,
  timingProfile,
  onComplete,
}: MembershipUnlockSequenceProps) {
  const [phase, setPhase] = useState<CeremonyPhase>("fade");
  const [showSkip, setShowSkip] = useState(false);
  const [liteEffects, setLiteEffects] = useState(false);
  const completedRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const reduceMotionHook = useReducedMotion();

  const timing = getUnlockTiming(timingProfile);
  const motionScale = timingProfile === "fast" ? 0.55 : 1;

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    timersRef.current.forEach(clearTimeout);
    markMemberWelcomePending();
    onComplete();
  }, [onComplete]);

  const skipToPortal = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    markMemberWelcomePending();
    finish();
  }, [finish]);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
  }, []);

  useEffect(() => {
    const isReduced =
      reduceMotionHook ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    setLiteEffects(isMobile);

    if (isReduced) {
      markMemberWelcomePending();
      schedule(finish, 400);
      return () => timersRef.current.forEach(clearTimeout);
    }

    const t = timing;
    let elapsed = 0;

    const chain = (next: CeremonyPhase, ms: number) => {
      schedule(() => setPhase(next), elapsed);
      elapsed += ms;
    };

    chain("lock", t.fade);
    chain("keyApproach", t.lockAppear + t.pauseBeforeKey);
    chain("keyTurn", t.keyApproach);
    schedule(() => {
      playLockClickSound();
      setPhase("unlock");
    }, elapsed);
    elapsed += t.keyTurn;
    chain("bloom", t.lockOpen);
    chain("welcomeOne", t.lightBloom);
    chain("welcomeBreath", t.welcomeOne);
    chain("welcomeTwo", t.welcomeBreath);
    chain("exit", t.welcomeTwo);
    schedule(finish, elapsed + t.portalHandoff);
    schedule(() => setShowSkip(true), t.skipAvailableAfter);

    return () => timersRef.current.forEach(clearTimeout);
  }, [finish, reduceMotionHook, schedule, timing]);

  const lockOpen =
    phase === "unlock" ||
    phase === "bloom" ||
    phase.startsWith("welcome") ||
    phase === "exit";
  const lightEscape = phase === "unlock" || phase === "bloom";
  const showBloom =
    phase === "bloom" || phase.startsWith("welcome") || phase === "exit";
  const cameraPush =
    phase === "bloom" || phase.startsWith("welcome") || phase === "exit";

  const keyPhase =
    phase === "fade" || phase === "lock"
      ? "hidden"
      : phase === "keyApproach"
        ? "approach"
        : phase === "keyTurn"
          ? "turn"
          : "insert";

  const showCeremony = phase !== "exit";
  const welcomeLine =
    phase === "welcomeOne" || phase === "welcomeBreath"
      ? UNLOCK_WELCOME_COPY.family
      : phase === "welcomeTwo" || phase === "exit"
        ? UNLOCK_WELCOME_COPY.care
        : null;

  return (
    <div
      className="fixed inset-0 z-[250] overflow-hidden bg-[#020202]"
      role="dialog"
      aria-modal="true"
      aria-label="Membership welcome ceremony"
    >
      {showSkip && phase !== "exit" && (
        <motion.button
          type="button"
          onClick={skipToPortal}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: easeCinematic }}
          className="absolute right-4 top-[max(0.75rem,env(safe-area-inset-top))] z-50 flex min-h-[48px] items-center gap-2 rounded-full border border-white/30 bg-black/70 px-5 py-2.5 text-xs font-medium uppercase tracking-[0.16em] text-white shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md touch-manipulation hover:border-white/50 hover:bg-black/80 sm:right-6"
        >
          Skip to portal
          <span aria-hidden className="text-white/60">
            →
          </span>
        </motion.button>
      )}

      <motion.div
        className="absolute inset-0 flex items-center justify-center will-change-transform"
        animate={{
          opacity: showCeremony ? 1 : 0,
          scale: cameraPush ? 1.03 : 1,
        }}
        transition={{
          duration: reduceMotionHook ? 0.2 : 1.8 * motionScale,
          ease: easeSlow,
        }}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === "fade" ? 0.4 : 1 }}
          transition={{ duration: 0.9 * motionScale, ease: easeCinematic }}
          className="absolute inset-0 bg-black"
        />

        {!liteEffects && (
          <div
            className="pointer-events-none absolute inset-0 opacity-25"
            style={{
              background:
                "radial-gradient(ellipse at 50% 42%, rgba(255,245,230,0.06) 0%, transparent 58%)",
            }}
          />
        )}

        <div className="relative flex flex-col items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{
              opacity: phase === "fade" ? 0 : 1,
              scale: phase === "fade" ? 0.96 : 1,
              y: phase === "fade" ? 10 : 0,
            }}
            transition={{ duration: 1.1 * motionScale, ease: easeCinematic }}
            className="relative"
          >
            <ChromePadlock
              open={lockOpen}
              lightEscape={lightEscape && !liteEffects}
              liteMode={liteEffects}
              motionScale={motionScale}
              className="h-40 w-auto sm:h-52 md:h-60"
            />
            <div className="absolute left-1/2 top-[58%] -translate-x-1/2">
              <CrownKey
                phase={keyPhase}
                motionScale={motionScale}
                className="h-24 w-auto sm:h-28"
              />
            </div>
          </motion.div>
        </div>

        {showBloom && (
          <motion.div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2 * motionScale, ease: easeBloom }}
          >
            <motion.div
              className="rounded-full will-change-[transform,opacity]"
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{
                opacity: liteEffects ? 0.55 : 0.72,
                scale: liteEffects ? 2.4 : 3.2,
              }}
              transition={{ duration: 2.4 * motionScale, ease: easeBloom }}
              style={{
                width: "min(90vw, 480px)",
                height: "min(90vw, 480px)",
                background:
                  "radial-gradient(circle, rgba(255,248,235,0.55) 0%, rgba(255,240,215,0.22) 32%, rgba(255,235,200,0.06) 55%, transparent 72%)",
              }}
            />
            {!liteEffects && (
              <motion.div
                className="absolute rounded-full"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 0.35, scale: 3.8 }}
                transition={{ duration: 3 * motionScale, ease: easeBloom }}
                style={{
                  width: "min(95vw, 520px)",
                  height: "min(95vw, 520px)",
                  background:
                    "radial-gradient(circle, rgba(255,252,245,0.18) 0%, transparent 65%)",
                }}
              />
            )}
          </motion.div>
        )}
      </motion.div>

      {welcomeLine && (
        <div className="absolute inset-0 flex items-center justify-center px-6 sm:px-8">
          <motion.div
            key={
              phase === "welcomeOne" || phase === "welcomeBreath"
                ? "family"
                : "care"
            }
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: phase === "exit" ? 0 : 1, y: 0 }}
            transition={{ duration: 1.1 * motionScale, ease: easeCinematic }}
            className="max-w-2xl text-center"
          >
            <p className="font-serif text-2xl font-light leading-snug tracking-tight text-white/95 sm:text-4xl md:text-5xl">
              {welcomeLine}
            </p>
            {(phase === "welcomeTwo" || phase === "exit") && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: phase === "exit" ? 0 : 0.7 }}
                transition={{ delay: 0.5 * motionScale, duration: 0.9 }}
                className="mt-6 text-[11px] uppercase tracking-[0.28em] text-white/45"
              >
                {context.propertyName}
              </motion.p>
            )}
          </motion.div>
        </div>
      )}

      <motion.div
        className="pointer-events-none absolute inset-0 bg-[#faf8f5]"
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === "exit" ? 1 : 0 }}
        transition={{ duration: 1.1 * motionScale, ease: easeSlow }}
        aria-hidden
      />
    </div>
  );
}
