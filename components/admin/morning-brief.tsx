"use client";

import { motion, useReducedMotion } from "framer-motion";
import { PLATFORM_BRAND } from "@/lib/brand/platform";
import type { MorningBrief } from "@/lib/concierge/types";
import { riseSubtle } from "@/lib/motion/system";
import { useBootLayerDelay } from "@/components/motion/boot-provider";

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
  baseDelay,
}: {
  title: string;
  body: string;
  category: string;
  index: number;
  baseDelay: number;
}) {
  const reduceMotion = useReducedMotion();
  const delay = baseDelay + index * 0.05;

  return (
    <motion.article
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      variants={riseSubtle}
      transition={{ delay }}
      className="border-b border-border/20 pb-8 last:border-b-0 last:pb-0"
    >
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted/70">
        {CATEGORY_LABELS[category] ?? category}
      </p>
      <h3 className="mt-2 font-serif text-xl font-light text-foreground">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </motion.article>
  );
}

export function MorningBriefSection({ brief }: { brief: MorningBrief }) {
  const reduceMotion = useReducedMotion();
  const baseDelay = useBootLayerDelay("morningBrief");
  const cards = brief.insights.slice(0, 3);

  return (
    <motion.section
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      variants={riseSubtle}
      transition={{ delay: baseDelay }}
      className="border-t border-border/25 pt-12"
      aria-labelledby="morning-brief-heading"
    >
      <div>
        <p className="text-[10px] uppercase tracking-[0.28em] text-muted/80">
          {PLATFORM_BRAND.morningBriefEyebrow}
        </p>
        <h2
          id="morning-brief-heading"
          className="mt-2 font-serif text-2xl font-light tracking-[-0.015em] text-foreground sm:text-[1.75rem]"
        >
          {PLATFORM_BRAND.morningBriefTitle}
        </h2>
      </div>

      {cards.length > 0 ? (
        <div className="mt-8 space-y-8">
          {cards.map((insight, index) => (
            <InsightCard
              key={insight.id}
              title={insight.title}
              body={insight.body}
              category={insight.category}
              index={index}
              baseDelay={baseDelay + 0.08}
            />
          ))}
        </div>
      ) : brief.fallbackMessage ? (
        <div className="mt-8 rounded-2xl border border-border/30 bg-background/20 px-6 py-8 text-center">
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
