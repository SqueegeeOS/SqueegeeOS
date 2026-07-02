"use client";

import { motion, useInView } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { fadeUp } from "../motion";

export function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.38em] text-accent">
      {children}
    </p>
  );
}

export function SectionTitle({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`font-serif text-4xl font-light leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-6xl ${className}`}
    >
      {children}
    </h2>
  );
}

export function SectionLead({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`max-w-2xl text-base leading-relaxed text-muted sm:text-lg sm:leading-relaxed ${className}`}
    >
      {children}
    </p>
  );
}

export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={{
        hidden: fadeUp.hidden,
        visible: {
          ...fadeUp.visible,
          transition: {
            ...fadeUp.visible.transition,
            delay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function Section({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`relative px-6 py-28 sm:px-10 sm:py-36 lg:px-16 lg:py-44 ${className}`}
    >
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

export function Divider() {
  return (
    <div className="mx-auto h-px max-w-6xl bg-gradient-to-r from-transparent via-border to-transparent" />
  );
}
