"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildWelcomeMessage,
  getUnlockSequenceTotalMs,
  UNLOCK_SEQUENCE_TIMING,
  type MembershipUnlockContext,
} from "@/lib/membership/unlock-sequence";
import { playLockClickSound } from "@/lib/membership/unlock-sound";
import { BrassLock } from "./brass-lock";
import { GoldKey } from "./gold-key";

interface MembershipUnlockSequenceProps {
  context: MembershipUnlockContext;
  onComplete: () => void;
}

const easeLuxury = [0.22, 1, 0.36, 1] as const;

export function MembershipUnlockSequence({
  context,
  onComplete,
}: MembershipUnlockSequenceProps) {
  const [phase, setPhase] = useState<
    "fade" | "lock" | "key" | "turn" | "open" | "burst" | "portal"
  >("fade");
  const [showSkip, setShowSkip] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const completedRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    timersRef.current.forEach(clearTimeout);
    onComplete();
  }, [onComplete]);

  const skipToPortal = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    setPhase("portal");
    window.setTimeout(finish, reducedMotion ? 200 : UNLOCK_SEQUENCE_TIMING.portalReveal);
  }, [finish, reducedMotion]);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const isReduced = mq.matches;
    setReducedMotion(isReduced);

    if (isReduced) {
      setPhase("portal");
      schedule(finish, 400);
      return () => timersRef.current.forEach(clearTimeout);
    }

    const t = UNLOCK_SEQUENCE_TIMING;

    schedule(() => setPhase("lock"), t.fade);
    schedule(() => setPhase("key"), t.fade + t.lockAppear + t.pauseBeforeKey);
    schedule(
      () => setPhase("turn"),
      t.fade + t.lockAppear + t.pauseBeforeKey + t.keyGlide,
    );
    schedule(() => {
      playLockClickSound();
      setPhase("open");
    }, t.fade + t.lockAppear + t.pauseBeforeKey + t.keyGlide + t.keyTurn);
    schedule(
      () => setPhase("burst"),
      t.fade +
        t.lockAppear +
        t.pauseBeforeKey +
        t.keyGlide +
        t.keyTurn +
        t.lockOpen,
    );
    schedule(
      () => setPhase("portal"),
      t.fade +
        t.lockAppear +
        t.pauseBeforeKey +
        t.keyGlide +
        t.keyTurn +
        t.lockOpen +
        t.lightBurst,
    );
    schedule(finish, getUnlockSequenceTotalMs());

    schedule(() => setShowSkip(true), t.skipAvailableAfter);

    return () => timersRef.current.forEach(clearTimeout);
  }, [finish, schedule]);

  const showLockScene = phase !== "portal";
  const lockOpen = phase === "open" || phase === "burst" || phase === "portal";
  const showBurst = phase === "burst" || phase === "portal";
  const showKey = phase !== "fade" && phase !== "lock" && phase !== "portal";
  const keyTurning = phase === "turn" || phase === "open";

  return (
    <div
      className="fixed inset-0 z-[250] overflow-hidden bg-[#030303]"
      role="dialog"
      aria-modal="true"
      aria-label="Membership welcome"
    >
      {showSkip && phase !== "portal" && (
        <button
          type="button"
          onClick={skipToPortal}
          className="absolute right-5 top-[max(1rem,env(safe-area-inset-top))] z-50 min-h-[44px] rounded-full border border-white/15 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-white/50 transition-colors hover:border-accent/40 hover:text-accent touch-manipulation"
        >
          Skip animation
        </button>
      )}

      {/* Portal reveal layer */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === "portal" ? 1 : 0 }}
        transition={{ duration: reducedMotion ? 0.3 : 0.7, ease: easeLuxury }}
      >
        <div className="absolute inset-0">
          <Image
            src={context.propertyHeroImage}
            alt=""
            fill
            priority
            className="object-cover opacity-40"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/70 to-background" />
        </div>

        <div className="relative flex min-h-[100svh] flex-col items-center justify-center px-6 text-center">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: easeLuxury, delay: 0.1 }}
            className="font-serif text-4xl font-light tracking-tight text-foreground sm:text-5xl md:text-6xl"
          >
            {buildWelcomeMessage(context.homeownerFirstName)}
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: easeLuxury, delay: 0.35 }}
            className="mt-4 text-[11px] uppercase tracking-[0.32em] text-accent"
          >
            {context.propertyName}
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.55 }}
            className="mt-8 max-w-sm text-sm leading-relaxed text-muted"
          >
            Your Homeowner Portal is ready. {context.planName} is now active.
          </motion.p>
        </div>
      </motion.div>

      {/* Lock ceremony layer */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={{ opacity: showLockScene ? 1 : 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === "fade" ? 0.3 : 1 }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0 bg-black"
        />

        <div className="relative flex h-48 w-48 items-center justify-center sm:h-56 sm:w-56">
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{
              opacity: phase === "fade" ? 0 : 1,
              scale: phase === "fade" ? 0.92 : 1,
            }}
            transition={{ duration: 0.65, ease: easeLuxury }}
          >
            <BrassLock open={lockOpen} className="h-36 w-auto sm:h-44" />
          </motion.div>

          {showKey && (
            <motion.div
              className="absolute left-1/2 top-1/2 z-10"
              initial={{ x: 120, y: 40, opacity: 0 }}
              animate={{
                x: keyTurning ? -8 : 36,
                y: keyTurning ? 8 : 20,
                opacity: 1,
              }}
              transition={{
                duration: keyTurning ? 0.35 : 0.55,
                ease: easeLuxury,
              }}
            >
              <GoldKey
                rotating={keyTurning}
                className="h-10 w-auto sm:h-12"
              />
            </motion.div>
          )}
        </div>

        {showBurst && (
          <motion.div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.2 }}
            animate={{ opacity: [0, 1, 0], scale: [0.2, 2.8, 3.2] }}
            transition={{ duration: 0.55, ease: easeLuxury }}
          >
            <div
              className="h-64 w-64 rounded-full sm:h-96 sm:w-96"
              style={{
                background:
                  "radial-gradient(circle, rgba(212,184,122,0.55) 0%, rgba(212,184,122,0.15) 35%, transparent 70%)",
              }}
            />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
