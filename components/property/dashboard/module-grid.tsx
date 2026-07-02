"use client";

import { motion } from "framer-motion";
import { easeLuxury } from "@/lib/property/motion";
import { Reveal } from "../ui/primitives";

const modules = [
  {
    name: "Timeline",
    description: "Every visit, chronologically preserved",
    status: "Active",
    count: "entries",
  },
  {
    name: "Photo Library",
    description: "Every image ever captured on site",
    status: "Active",
    count: "photos",
  },
  {
    name: "AI Intelligence",
    description: "Summaries, notes, and score analysis",
    status: "Active",
    count: "insights",
  },
  {
    name: "Membership",
    description: "Plan, benefits, and agreements",
    status: "Active",
    count: "plan",
  },
  {
    name: "Recommendations",
    description: "Prioritized care for this property",
    status: "Active",
    count: "items",
  },
  {
    name: "Documents",
    description: "Agreements, proposals, and records",
    status: "Coming",
    count: "files",
  },
] as const;

export function ModuleGrid({
  timelineLength,
  photoCount,
  recommendationCount = 3,
}: {
  timelineLength: number;
  photoCount: number;
  recommendationCount?: number;
}) {
  const counts: Record<string, string | number> = {
    Timeline: timelineLength,
    "Photo Library": photoCount,
    "AI Intelligence": "Live",
    Membership: "1",
    Recommendations: recommendationCount,
    Documents: "—",
  };

  return (
    <div>
      <Reveal>
        <p className="text-[11px] font-medium uppercase tracking-[0.38em] text-accent">
          Connected Systems
        </p>
        <h2 className="mt-4 font-serif text-3xl font-light tracking-tight text-foreground sm:text-4xl">
          The property&apos;s brain
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">
          Every future feature connects here — visits feed the timeline, photos
          build the archive, AI refines the story.
        </p>
      </Reveal>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod, index) => (
          <Reveal key={mod.name} delay={0.05 * index}>
            <motion.div
              whileHover={{ y: -3 }}
              transition={{ duration: 0.35, ease: easeLuxury }}
              className={`rounded-2xl border p-6 sm:p-7 ${
                mod.status === "Coming"
                  ? "border-border/60 bg-surface/50 opacity-60"
                  : "border-border bg-surface"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted">
                  {mod.name}
                </p>
                <span
                  className={`text-[10px] uppercase tracking-[0.2em] ${
                    mod.status === "Active" ? "text-accent/80" : "text-muted"
                  }`}
                >
                  {mod.status}
                </span>
              </div>
              <p className="mt-4 font-serif text-3xl font-light text-foreground">
                {counts[mod.name]}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {mod.description}
              </p>
            </motion.div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
