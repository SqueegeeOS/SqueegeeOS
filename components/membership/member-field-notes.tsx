"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ServiceObservationView } from "@/lib/persistence/queries/member-portal";

const easeLuxury = [0.16, 1, 0.3, 1] as const;

function formatObservationDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function MemberFieldNotes({
  observations,
  entranceDelay = 0.65,
}: {
  observations: ServiceObservationView[];
  entranceDelay?: number;
}) {
  const reduceMotion = useReducedMotion();

  if (observations.length === 0) return null;

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 1,
        delay: reduceMotion ? 0 : entranceDelay,
        ease: easeLuxury,
      }}
      className="mt-10 overflow-hidden rounded-3xl border border-border bg-surface/40"
    >
      <div className="border-b border-border/70 px-5 py-6 sm:px-7">
        <p className="text-[10px] uppercase tracking-[0.28em] text-accent">
          From your care team
        </p>
        <h2 className="mt-2 font-serif text-2xl font-light text-foreground">
          Field notes
        </h2>
        <p className="mt-2 text-sm text-muted">
          Observations from recent visits — documented for your home record.
        </p>
      </div>

      <ul className="divide-y divide-border/60">
        {observations.map((observation) => (
          <li key={observation.id} className="px-5 py-5 sm:px-7">
            <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted">
              <span>{formatObservationDate(observation.observedAt)}</span>
              {observation.observedBy && (
                <>
                  <span aria-hidden>·</span>
                  <span>{observation.observedBy}</span>
                </>
              )}
              {observation.severity && (
                <>
                  <span aria-hidden>·</span>
                  <span className="text-foreground/70">{observation.severity}</span>
                </>
              )}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-foreground/90">
              {observation.notes}
            </p>
          </li>
        ))}
      </ul>
    </motion.section>
  );
}
