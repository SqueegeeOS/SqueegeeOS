"use client";

import { motion, useReducedMotion } from "framer-motion";

const easeLuxury = [0.22, 1, 0.36, 1] as const;

export function AdminSection({
  eyebrow,
  title,
  description,
  children,
  delay = 0,
  id,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  delay?: number;
  id?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      id={id}
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: reduceMotion ? 0 : delay, ease: easeLuxury }}
      className="rounded-[2rem] border border-border/80 bg-surface/55 p-6 backdrop-blur-sm sm:p-8"
    >
      <p className="text-[10px] uppercase tracking-[0.28em] text-accent">{eyebrow}</p>
      <h2 className="mt-3 font-serif text-2xl font-light text-foreground sm:text-3xl">
        {title}
      </h2>
      {description && (
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
      )}
      <div className="mt-6">{children}</div>
    </motion.section>
  );
}
