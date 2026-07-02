"use client";

import { motion } from "framer-motion";
import type { TimelineEntry } from "@/lib/property/types";
import { easeLuxury } from "@/lib/property/motion";
import { Reveal } from "../ui/primitives";

export function TimelinePreview({
  entries,
  totalLength,
}: {
  entries: TimelineEntry[];
  totalLength: number;
}) {
  return (
    <div>
      <Reveal>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.38em] text-accent">
              Property Timeline
            </p>
            <h2 className="mt-4 font-serif text-3xl font-light tracking-tight text-foreground sm:text-4xl">
              The living history
            </h2>
          </div>
          <p className="hidden text-[11px] uppercase tracking-[0.28em] text-muted sm:block">
            {totalLength} entries
          </p>
        </div>
      </Reveal>

      <div className="relative mt-10">
        <div className="absolute bottom-0 left-[7px] top-0 w-px bg-gradient-to-b from-accent/40 via-border to-transparent" />

        <div className="space-y-0">
          {entries.map((entry, index) => (
            <Reveal key={entry.id} delay={0.06 * index}>
              <motion.article
                whileHover={{ x: 4 }}
                transition={{ duration: 0.35, ease: easeLuxury }}
                className="relative grid gap-4 border-b border-border py-8 pl-8 sm:grid-cols-[140px_1fr] sm:gap-8"
              >
                <div className="absolute left-0 top-10 h-3.5 w-3.5 rounded-full border border-accent/40 bg-background" />

                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-muted">
                    {entry.date}
                  </p>
                  <p className="mt-2 text-sm text-foreground/80">
                    {entry.technician}
                  </p>
                </div>

                <div>
                  <h3 className="font-serif text-xl font-light tracking-tight text-foreground sm:text-2xl">
                    {entry.title}
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
                    {entry.summary}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] uppercase tracking-[0.2em] text-muted">
                    <span>{entry.photoCount} photos</span>
                    {entry.scoreChange !== undefined && (
                      <span
                        className={
                          entry.scoreChange >= 0
                            ? "text-emerald-400/80"
                            : "text-amber-400/80"
                        }
                      >
                        Score {entry.scoreChange >= 0 ? "+" : ""}
                        {entry.scoreChange}
                      </span>
                    )}
                    <span>{entry.servicesCompleted.length} services</span>
                  </div>
                </div>
              </motion.article>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}
