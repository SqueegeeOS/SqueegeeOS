"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AtlasMark } from "@/components/theme/atlas-mark";
import { ceremonyCopy } from "@/lib/referrals/ceremony-copy";

const CEREMONY_MS = 2100;

/** Constellation spark positions (percent of overlay), restrained by design. */
const SPARKS: Array<{ left: string; top: string; delay: number }> = [
  { left: "32%", top: "26%", delay: 0.35 },
  { left: "68%", top: "22%", delay: 0.55 },
  { left: "76%", top: "58%", delay: 0.75 },
  { left: "24%", top: "62%", delay: 0.9 },
  { left: "55%", top: "74%", delay: 1.05 },
];

/**
 * The HomeAtlas Lux claim ceremony: a calm, full-screen moment on a
 * near-black field — warm ivory Atlas rings, a few gold constellation
 * sparks, and the confirmation text. Auto-settles after ~2s, settles
 * immediately if the tab is backgrounded, and can be dismissed with
 * Escape or Enter. Reduced motion renders a static ring bloom with the
 * identical confirmation text; screen readers get the full message via
 * dialog semantics either way.
 */
export function ClaimCeremony({
  open,
  firstName,
  rewardLabel,
  onSettled,
}: {
  open: boolean;
  firstName: string;
  rewardLabel: string;
  onSettled: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const settledRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    settledRef.current = false;

    const settle = () => {
      if (settledRef.current) return;
      settledRef.current = true;
      onSettled();
    };

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialogRef.current?.focus();

    const timer = window.setTimeout(settle, CEREMONY_MS);

    // Background tabs throttle timers; the ceremony must never outlive ~2s
    // of real attention. Hidden tab or navigation settles immediately.
    const onVisibility = () => {
      if (document.visibilityState === "hidden") settle();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter") settle();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onVisibility);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onVisibility);
      window.removeEventListener("keydown", onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open, onSettled]);

  const lines = ceremonyCopy(firstName, rewardLabel, false);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: reducedMotion ? 1 : 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: reducedMotion ? 0 : 0.35 } }}
          transition={{ duration: reducedMotion ? 0 : 0.4 }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-[#05060a]/[0.97] px-6"
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Reward claimed"
            tabIndex={-1}
            className="relative flex max-w-md flex-col items-center text-center outline-none"
          >
            {!reducedMotion
              ? SPARKS.map((spark) => (
                  <motion.span
                    key={`${spark.left}-${spark.top}`}
                    aria-hidden
                    initial={{ opacity: 0, scale: 0.4 }}
                    animate={{ opacity: [0, 0.9, 0.5], scale: 1 }}
                    transition={{ delay: spark.delay, duration: 0.9 }}
                    className="fixed h-[3px] w-[3px] rounded-full bg-[#d3b477]"
                    style={{ left: spark.left, top: spark.top }}
                  />
                ))
              : null}

            <motion.div
              initial={reducedMotion ? false : { scale: 0.82, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: reducedMotion ? 0 : 0.7, ease: "easeOut" }}
              className="text-[#f4efe4]"
            >
              <AtlasMark size={96} className="!text-[#f4efe4]" />
            </motion.div>

            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reducedMotion ? 0 : 0.45, duration: reducedMotion ? 0 : 0.6 }}
              className="mt-8 space-y-3"
            >
              <p className="font-serif text-2xl font-light text-[#f4efe4]">
                {lines[0]}
              </p>
              <p className="text-sm leading-relaxed text-[#f4efe4]/85">
                {lines[1]}
              </p>
              <p className="text-sm leading-relaxed text-[#f4efe4]/70">
                {lines[2]}
              </p>
              <p className="text-xs leading-relaxed text-[#d3b477]">
                {lines[3]}
              </p>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
