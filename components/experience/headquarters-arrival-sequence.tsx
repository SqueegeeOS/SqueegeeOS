"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { AmbientField } from "@/components/motion/ambient-field";
import { HeadlineReveal, LineReveal } from "@/components/motion/typography-reveal";
import { headquartersGreeting } from "@/lib/motion/boot-sequence";
import { spring } from "@/lib/motion/system";
import { emitSound } from "@/lib/motion/sound-events";

interface HeadquartersArrivalSequenceProps {
  onComplete: () => void;
  previewMode?: boolean;
}

export function HeadquartersArrivalSequence({
  onComplete,
  previewMode = false,
}: HeadquartersArrivalSequenceProps) {
  const reduceMotion = useReducedMotion();
  const completedRef = useRef(false);
  const [showSkip, setShowSkip] = useState(false);
  const [focusPhase, setFocusPhase] = useState(reduceMotion ? 1 : 0);

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    emitSound("boot.complete");
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    if (reduceMotion) {
      const id = setTimeout(finish, 400);
      return () => clearTimeout(id);
    }

    const focusTimer = setTimeout(() => setFocusPhase(1), 180);
    const skipTimer = setTimeout(() => setShowSkip(true), 1400);
    const completeTimer = setTimeout(finish, previewMode ? 6800 : 6800);

    return () => {
      clearTimeout(focusTimer);
      clearTimeout(skipTimer);
      clearTimeout(completeTimer);
    };
  }, [finish, previewMode, reduceMotion]);

  const greeting = headquartersGreeting("Noah");

  return (
    <div
      className="fixed inset-0 z-[240] overflow-hidden bg-background"
      role="dialog"
      aria-modal="true"
      aria-label="Headquarters arrival"
    >
      <AmbientField breathing />

      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 backdrop-blur-md"
        initial={{ opacity: 1 }}
        animate={{ opacity: focusPhase ? 0 : 1 }}
        transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
      />

      {showSkip && (
        <button
          type="button"
          onClick={finish}
          className="absolute right-4 top-[max(0.75rem,env(safe-area-inset-top))] z-50 rounded-full border border-border bg-background/90 px-5 py-2.5 text-[10px] uppercase tracking-[0.18em] text-muted backdrop-blur-sm touch-manipulation hover:border-accent/30 hover:text-accent sm:right-6"
        >
          Skip
        </button>
      )}

      <div className="flex min-h-[100svh] items-center px-5 py-16 sm:px-10">
        <div className="mx-auto w-full max-w-4xl border-b border-border/70 pb-10">
          <motion.p
            initial={reduceMotion ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.32, ...spring.settle }}
            className="text-[10px] uppercase tracking-[0.32em] text-muted"
          >
            SqueegeeKing Headquarters
          </motion.p>

          <HeadlineReveal
            as="h1"
            text={greeting}
            className="mt-4 font-serif text-4xl font-light leading-[1.05] text-foreground sm:text-6xl"
            delay={0.55}
            wordDelay={0.07}
          />

          <LineReveal
            className="mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg"
            delay={1.05}
          >
            Your company is alive. Let&apos;s continue building it today.
          </LineReveal>

          <LineReveal
            className="mt-8 text-sm text-muted/75"
            delay={1.55}
          >
            The Legacy is preserved. The Operating System is tracking forward.
          </LineReveal>
        </div>
      </div>
    </div>
  );
}
