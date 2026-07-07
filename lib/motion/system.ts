import type { Transition, Variants } from "framer-motion";

/** Engineered easing — Vision Pro / Linear cadence. */
export const easeEngineered = [0.16, 1, 0.3, 1] as const;

/** Physics-first springs — controlled, never bouncy. */
export const spring = {
  glass: {
    type: "spring",
    stiffness: 320,
    damping: 36,
    mass: 0.85,
  } satisfies Transition,
  settle: {
    type: "spring",
    stiffness: 260,
    damping: 32,
    mass: 0.95,
  } satisfies Transition,
  press: {
    type: "spring",
    stiffness: 520,
    damping: 34,
    mass: 0.65,
  } satisfies Transition,
  magnetic: {
    type: "spring",
    stiffness: 200,
    damping: 26,
    mass: 0.5,
  } satisfies Transition,
  breathe: {
    type: "spring",
    stiffness: 40,
    damping: 20,
    mass: 1.1,
  } satisfies Transition,
  draw: {
    type: "spring",
    stiffness: 140,
    damping: 28,
    mass: 0.9,
  } satisfies Transition,
} as const;

/** Primary surface entrance — rises from canvas into focus. */
export const materialize: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.992,
    y: 8,
    filter: "blur(6px)",
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: "blur(0px)",
    transition: spring.glass,
  },
};

/** Lighter entrance for dense layouts (stat grids, lists). */
export const riseSubtle: Variants = {
  hidden: {
    opacity: 0,
    y: 6,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: spring.settle,
  },
};

export const navigationEnter: Variants = {
  hidden: { opacity: 0, x: -6 },
  visible: {
    opacity: 1,
    x: 0,
    transition: spring.settle,
  },
};

/** Whole-line headline — prefer over per-word unless ceremony. */
export const headlineLine: Variants = {
  hidden: { opacity: 0, y: 8, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: spring.settle,
  },
};

export const headlineWord: Variants = {
  hidden: { opacity: 0, filter: "blur(6px)", y: 4 },
  visible: {
    opacity: 1,
    filter: "blur(0px)",
    y: 0,
    transition: spring.settle,
  },
};

export const lineReveal: Variants = {
  hidden: { opacity: 0, y: 5 },
  visible: {
    opacity: 1,
    y: 0,
    transition: spring.settle,
  },
};

export const staggerDepth = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.05, delayChildren: 0.03 },
  },
} satisfies Variants;

export const pageEnter: Variants = {
  hidden: {
    opacity: 0,
    y: 10,
    filter: "blur(4px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: spring.settle,
  },
};

export const buttonPress = {
  whileTap: { scale: 0.985 },
  transition: spring.press,
} as const;

export const staggerItem = (index: number) => index * 0.05;
