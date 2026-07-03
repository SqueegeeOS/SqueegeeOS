"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

const easeLuxury = [0.22, 1, 0.36, 1] as const;

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

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    if (reduceMotion) {
      const id = setTimeout(finish, 500);
      return () => clearTimeout(id);
    }

    const skipTimer = setTimeout(() => setShowSkip(true), 1200);
    const completeTimer = setTimeout(finish, previewMode ? 6200 : 6200);

    return () => {
      clearTimeout(skipTimer);
      clearTimeout(completeTimer);
    };
  }, [finish, previewMode, reduceMotion]);

  const line = (delay: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.85, delay, ease: easeLuxury },
        };

  return (
    <div
      className="fixed inset-0 z-[240] overflow-hidden bg-background"
      role="dialog"
      aria-modal="true"
      aria-label="Headquarters arrival preview"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,184,150,0.08),transparent_55%)]" />

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
            {...line(0.2)}
            className="text-[10px] uppercase tracking-[0.32em] text-muted"
          >
            SqueegeeKing Headquarters
          </motion.p>
          <motion.h1
            {...line(0.55)}
            className="mt-4 font-serif text-4xl font-light leading-[1.05] text-foreground sm:text-6xl"
          >
            Welcome back, Noah &amp; Dasan.
          </motion.h1>
          <motion.p
            {...line(1.0)}
            className="mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg"
          >
            Your company is alive. Let&apos;s continue building it today.
          </motion.p>
          <motion.p
            {...line(1.55)}
            className="mt-8 text-sm text-muted/75"
          >
            The Legacy is preserved. The Operating System is tracking forward.
          </motion.p>
        </div>
      </div>
    </div>
  );
}
