"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { LegacyMilestone } from "@/lib/admin/legacy-baseline";
import type { OsTimelineEvent } from "@/lib/admin/os-timeline";

const easeLuxury = [0.22, 1, 0.36, 1] as const;

function LegacyTimelineColumn({
  items,
  emptyMessage,
}: {
  items: Array<{ id: string; year: string; label: string }>;
  emptyMessage: string;
}) {
  return (
    <article className="rounded-[1.75rem] border border-border/50 bg-gradient-to-b from-stone-500/[0.03] to-background/30 p-6 sm:p-7">
      <p className="text-[10px] uppercase tracking-[0.28em] text-muted">
        The Legacy
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted/80">
        History — preserved, never auto-generated.
      </p>

      {items.length === 0 ? (
        <p className="mt-8 text-sm text-muted">{emptyMessage}</p>
      ) : (
        <ol className="relative mt-8 space-y-0 border-l border-border/40 pl-6">
          {items.map((item) => (
            <li key={item.id} className="relative pb-7 last:pb-0">
              <span className="absolute -left-[1.84rem] top-1.5 h-2 w-2 rounded-full bg-muted/40" />
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted/70">
                {item.year}
              </p>
              <p className="mt-1 font-serif text-lg font-light text-foreground/85">
                {item.label}
              </p>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

function OsTimelineColumn({
  items,
  emptyMessage,
}: {
  items: Array<{ id: string; year: string; label: string }>;
  emptyMessage: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <article className="rounded-[1.75rem] border border-accent/25 bg-gradient-to-br from-accent/[0.07] via-surface/50 to-background/40 p-6 sm:p-7 shadow-[0_0_0_1px_rgba(201,184,150,0.06)]">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/40 opacity-40" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent/70" />
        </span>
        <p className="text-[10px] uppercase tracking-[0.28em] text-accent">
          The Operating System
        </p>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted/85">
        Today — tracked live, updated automatically.
      </p>

      {items.length === 0 ? (
        <p className="mt-8 text-sm text-muted">{emptyMessage}</p>
      ) : (
        <ol className="relative mt-8 space-y-0 border-l border-accent/25 pl-6">
          {items.map((item, index) => (
            <motion.li
              key={item.id}
              initial={reduceMotion ? false : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.45,
                delay: reduceMotion ? 0 : index * 0.04,
                ease: easeLuxury,
              }}
              className="relative pb-7 last:pb-0"
            >
              <span className="absolute -left-[1.84rem] top-1.5 h-2.5 w-2.5 rounded-full border border-accent/50 bg-accent/25" />
              <p className="text-[10px] uppercase tracking-[0.18em] text-accent/80">
                {item.year}
              </p>
              <p className="mt-1 font-serif text-lg font-light text-foreground">
                {item.label}
              </p>
            </motion.li>
          ))}
        </ol>
      )}
    </article>
  );
}

interface AdminDualTimelinesProps {
  legacyMilestones: LegacyMilestone[];
  osEvents: OsTimelineEvent[];
}

export function AdminDualTimelines({
  legacyMilestones,
  osEvents,
}: AdminDualTimelinesProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <LegacyTimelineColumn
        items={legacyMilestones.map((item) => ({
          id: item.id,
          year: item.year,
          label: item.label,
        }))}
        emptyMessage="Your legacy timeline appears after preserving the archive."
      />
      <OsTimelineColumn
        items={osEvents.map((item) => ({
          id: item.id,
          year: item.monthLabel,
          label: item.label,
        }))}
        emptyMessage="Platform activated. Log your first sale to begin the live timeline."
      />
    </div>
  );
}
