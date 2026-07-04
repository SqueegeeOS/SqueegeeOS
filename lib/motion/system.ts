import type { Transition, Variants } from "framer-motion";

/** Engineered easing — no bounce, no playfulness. Vision Pro / Linear cadence. */
export const easeEngineered = [0.16, 1, 0.3, 1] as const;

/** Physics-first springs — mass, damping, intentional overshoot. */
export const spring = {
  /** Glass materializing into focus */
  glass: {
    type: "spring",
    stiffness: 280,
    damping: 32,
    mass: 0.9,
  } satisfies Transition,
  /** Typography and content settling */
  settle: {
    type: "spring",
    stiffness: 220,
    damping: 28,
    mass: 1.05,
  } satisfies Transition,
  /** Button press and release */
  press: {
    type: "spring",
    stiffness: 520,
    damping: 34,
    mass: 0.65,
  } satisfies Transition,
  /** Magnetic cursor attraction */
  magnetic: {
    type: "spring",
    stiffness: 180,
    damping: 22,
    mass: 0.55,
  } satisfies Transition,
  /** Ambient background breathing */
  breathe: {
    type: "spring",
    stiffness: 40,
    damping: 18,
    mass: 1.2,
  } satisfies Transition,
  /** Chart path draw */
  draw: {
    type: "spring",
    stiffness: 120,
    damping: 24,
    mass: 1,
  } satisfies Transition,
} as const;

/** Glass moving into focus — never a plain fade. */
export const materialize: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.985,
    y: 10,
    filter: "blur(10px)",
    boxShadow: "0 0 0 rgba(0,0,0,0)",
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: "blur(0px)",
    boxShadow: "0 24px 48px -24px rgba(0,0,0,0.45)",
    transition: spring.glass,
  },
};

export const navigationEnter: Variants = {
  hidden: { opacity: 0, x: -8, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: spring.settle,
  },
};

export const headlineWord: Variants = {
  hidden: { opacity: 0, filter: "blur(14px)", y: 6 },
  visible: {
    opacity: 1,
    filter: "blur(0px)",
    y: 0,
    transition: spring.settle,
  },
};

export const lineReveal: Variants = {
  hidden: { opacity: 0, y: 8, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: spring.settle,
  },
};

export const staggerDepth = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
} satisfies Variants;

/** Per-item stagger offset for boot layers */
export const staggerItem = (index: number) => index * 0.07;
