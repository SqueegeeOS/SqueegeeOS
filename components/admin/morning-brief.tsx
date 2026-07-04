"use client";

import { motion, useReducedMotion } from "framer-motion";
import { PLATFORM_BRAND } from "@/lib/brand/platform";
import type { MorningBrief } from "@/lib/concierge/types";

const easeLuxury = [0.22, 1, 0.36, 1] as const;

const CATEGORY_LABELS: Record<string, string> = {
  revenue: "Revenue",
  arr: "ARR",
  reputation: "Reputation",
  operations: "Operations",
  membership: "Membership",
  platform: "HomeAtlas",
};

function InsightCard({
  title,
  body,
  category,
  index,
}: {
  title: string;
  body: string;
  category: string;
  index: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.65,
        delay: reduceMotion ? 0 : index * 0.06,
        ease: easeLuxury,
      }}
      className="rounded-[1.35rem] border border-border/70 bg-background/45 px-5 py-5 sm:px-6"
    >
      <p className="text-[10px] uppercase tracking-[0.22em] text-muted">
        {CATEGORY_LABELS[category] ?? category}
      </p>
      <h3 className="mt-3 font-serif text-xl font-light text-foreground">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p>
    </motion.article>
  );
}

export function MorningBriefSection({ brief }: { brief: MorningBrief }) {
  const reduceMotion = useReducedMotion();
  const cards = brief.insights.slice(0, 5);

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.75, ease: easeLuxury }}
      className="rounded-[2rem] border border-border/80 bg-surface/55 p-6 backdrop-blur-sm sm:p-8"
      aria-labelledby="morning-brief-heading"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.32em] text-accent">
            {PLATFORM_BRAND.morningBriefEyebrow}
          </p>
          <h2
            id="morning-brief-heading"
            className="mt-3 font-serif text-2xl font-light text-foreground sm:text-3xl"
          >
            {PLATFORM_BRAND.morningBriefTitle}
          </h2>
          <p className="mt-2 text-sm text-muted">
            What {PLATFORM_BRAND.conciergeCodename} noticed for today.
          </p>
        </div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted/70">
          {PLATFORM_BRAND.conciergeCodename} · rule-based · v0.1
        </p>
      </div>

      {cards.length > 0 ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((insight, index) => (
            <InsightCard
              key={insight.id}
              title={insight.title}
              body={insight.body}
              category={insight.category}
              index={index}
            />
          ))}
        </div>
      ) : brief.fallbackMessage ? (
        <div className="mt-8 rounded-[1.35rem] border border-border/60 bg-background/35 px-6 py-8 text-center">
          <p className="font-serif text-xl font-light text-foreground/90">
            {brief.fallbackMessage}
          </p>
        </div>
      ) : null}

      {brief.fallbackMessage && cards.length > 0 && cards.length < 3 && (
        <p className="mt-6 text-center text-sm text-muted">
          {brief.fallbackMessage}
        </p>
      )}
    </motion.section>
  );
}
