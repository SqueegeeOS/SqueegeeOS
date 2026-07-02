export const easeLuxury = [0.22, 1, 0.36, 1] as const;

export const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.75, ease: easeLuxury },
  },
};

export const stagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.09, delayChildren: 0.08 },
  },
};
