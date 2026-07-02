"use client";

import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

export const REQUEST_PLAN_MESSAGES = [
  "Crafting Your Home Care Plan",
  "Inspecting Your Property Profile",
  "Preparing Your Personalized Experience",
  "Almost Ready",
] as const;

const easeLuxury = [0.22, 1, 0.36, 1] as const;

const TIMING = {
  fade: 500,
  wipe: 4200,
  messageInterval: 1000,
  messageFadeOut: 400,
  reducedTotal: 700,
} as const;

interface RequestPlanTransitionProps {
  active: boolean;
  onComplete: () => void;
  messages?: readonly string[];
}

function PremiumSqueegee({
  className = "",
  progress = 0,
}: {
  className?: string;
  progress?: number;
}) {
  const droplets = [
    { x: 148, y: 52, r: 2.2, o: 0.35 },
    { x: 138, y: 58, r: 1.6, o: 0.28 },
    { x: 158, y: 54, r: 1.4, o: 0.22 },
    { x: 132, y: 50, r: 1.8, o: 0.3 },
    { x: 152, y: 60, r: 1.2, o: 0.18 },
  ];

  return (
    <svg
      viewBox="0 0 220 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="sqHandle" x1="0" y1="0" x2="0" y2="72">
          <stop offset="0%" stopColor="#3a3a3a" />
          <stop offset="45%" stopColor="#1a1a1a" />
          <stop offset="100%" stopColor="#0d0d0d" />
        </linearGradient>
        <linearGradient id="sqMetal" x1="0" y1="0" x2="220" y2="0">
          <stop offset="0%" stopColor="#8a8078" />
          <stop offset="50%" stopColor="#c4bcb0" />
          <stop offset="100%" stopColor="#7a7268" />
        </linearGradient>
        <linearGradient id="sqBlade" x1="0" y1="0" x2="0" y2="16">
          <stop offset="0%" stopColor="#2a2a2a" />
          <stop offset="100%" stopColor="#0a0a0a" />
        </linearGradient>
      </defs>
      <rect x="8" y="14" width="28" height="44" rx="6" fill="url(#sqHandle)" />
      <rect
        x="10"
        y="16"
        width="8"
        height="40"
        rx="3"
        fill="rgba(255,255,255,0.06)"
      />
      <rect x="36" y="30" width="120" height="12" rx="2" fill="url(#sqMetal)" />
      <rect x="36" y="32" width="120" height="3" fill="rgba(255,255,255,0.18)" />
      <rect x="156" y="38" width="56" height="14" rx="1" fill="url(#sqBlade)" />
      <rect
        x="156"
        y="38"
        width="56"
        height="2"
        fill="rgba(255,255,255,0.12)"
      />
      {droplets.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={d.r}
          fill={`rgba(180,200,220,${d.o * (0.5 + progress * 0.5)})`}
        />
      ))}
    </svg>
  );
}

export function RequestPlanTransition({
  active,
  onComplete,
  messages = REQUEST_PLAN_MESSAGES,
}: RequestPlanTransitionProps) {
  const [fadeIn, setFadeIn] = useState(false);
  const [wipeProgress, setWipeProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [showMessage, setShowMessage] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const completedRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const progressMotion = useMotionValue(0);
  const uncleanedClip = useTransform(
    progressMotion,
    [0, 1],
    [
      "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
      "polygon(100% 0%, 100% 0%, 100% 100%, 100% 100%)",
    ],
  );

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    timersRef.current.forEach(clearTimeout);
    onComplete();
  }, [onComplete]);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
  }, []);

  useEffect(() => {
    if (!active) return;

    completedRef.current = false;
    setFadeIn(false);
    setWipeProgress(0);
    setMessageIndex(0);
    setShowMessage(false);
    progressMotion.set(0);

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const isReduced = mq.matches;
    setReducedMotion(isReduced);

    if (isReduced) {
      setFadeIn(true);
      setShowMessage(true);
      setMessageIndex(messages.length - 1);
      schedule(finish, TIMING.reducedTotal);
      return () => timersRef.current.forEach(clearTimeout);
    }

    schedule(() => setFadeIn(true), 50);

    const wipeStart = TIMING.fade;
    const wipeEnd = wipeStart + TIMING.wipe;

    schedule(() => setShowMessage(true), wipeStart + 200);

    messages.forEach((_, i) => {
      schedule(() => setMessageIndex(i), wipeStart + i * TIMING.messageInterval);
    });

    const start = performance.now();
    let frameId = 0;

    const animateWipe = (now: number) => {
      const elapsed = now - start;
      if (elapsed < wipeStart) {
        frameId = requestAnimationFrame(animateWipe);
        return;
      }

      const t = Math.min((elapsed - wipeStart) / TIMING.wipe, 1);
      const eased = 1 - Math.pow(1 - t, 2.4);
      setWipeProgress(eased);
      progressMotion.set(eased);

      if (t < 1) {
        frameId = requestAnimationFrame(animateWipe);
      }
    };

    frameId = requestAnimationFrame(animateWipe);

    schedule(() => setShowMessage(false), wipeEnd);
    schedule(finish, wipeEnd + TIMING.messageFadeOut);

    return () => {
      cancelAnimationFrame(frameId);
      timersRef.current.forEach(clearTimeout);
    };
  }, [active, finish, messages, progressMotion, schedule]);

  if (!active) return null;

  const squeegeeLeft = `calc(${-12 + wipeProgress * 112}vw - 4rem)`;

  return (
    <div
      className="fixed inset-0 z-[200] overflow-hidden"
      role="status"
      aria-live="polite"
      aria-label={
        showMessage ? messages[messageIndex] : "Preparing your experience"
      }
    >
      <motion.div
        className="absolute inset-0 bg-black/50 backdrop-blur-[8px]"
        style={{ clipPath: uncleanedClip }}
        initial={{ opacity: 0 }}
        animate={{ opacity: fadeIn ? 1 : 0 }}
        transition={{ duration: reducedMotion ? 0.2 : 0.5, ease: easeLuxury }}
      />

      <motion.div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-accent/[0.04] backdrop-blur-[2px]"
        style={{ clipPath: uncleanedClip }}
      />

      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.04) 50%, transparent 60%)",
          opacity: wipeProgress * 0.6,
          transform: `translateX(${wipeProgress * 100 - 50}vw)`,
        }}
      />

      <AnimatePresence mode="wait">
        {showMessage && (
          <motion.div
            key={messageIndex}
            className="pointer-events-none absolute inset-0 flex items-center justify-center px-8"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: reducedMotion ? 0.15 : 0.45, ease: easeLuxury }}
          >
            <p className="max-w-md text-center font-serif text-2xl font-light tracking-tight text-foreground sm:text-3xl md:text-4xl">
              {messages[messageIndex]}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {!reducedMotion && (
        <motion.div
          className="pointer-events-none absolute top-1/2 -translate-y-1/2"
          style={{ left: squeegeeLeft }}
          initial={{ opacity: 0 }}
          animate={{ opacity: wipeProgress > 0.02 ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="relative">
            <PremiumSqueegee
              progress={wipeProgress}
              className="relative h-10 w-auto drop-shadow-[0_8px_24px_rgba(0,0,0,0.45)] sm:h-14 md:h-16"
            />
          </div>
        </motion.div>
      )}
    </div>
  );
}
