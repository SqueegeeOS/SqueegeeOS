"use client";

import { motion, useReducedMotion } from "framer-motion";
import { GlassCard } from "@/components/craft/glass-card";
import { PLATFORM_BRAND } from "@/lib/brand/platform";
import type { MorningBrief } from "@/lib/concierge/types";
import { craftEyebrow, craftHeading } from "@/lib/craft/tokens";
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
      className="craft-glass-subtle rounded-[var(--radius-card)] p-5 shadow-[var(--shadow-ambient)] sm:p-6"
    >
      <p className={`${craftEyebrow} opacity-70`}>
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
      className="border-t border-border/15 pt-14"
      aria-labelledby="morning-brief-heading"
    >
      <GlassCard tone="default" rim padding="lg" motion="none">
        <div>
          <p className={craftEyebrow}>{PLATFORM_BRAND.morningBriefEyebrow}</p>
          <h2
            id="morning-brief-heading"
            className={`${craftHeading} mt-3 text-2xl sm:text-[1.75rem]`}
          >
            {PLATFORM_BRAND.morningBriefTitle}
          </h2>
        </div>

        {cards.length > 0 ? (
          <div className="mt-8 grid gap-4">
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
          <GlassCard tone="subtle" motion="rise" className="mt-8 px-6 py-8 text-center">
            <p className="font-serif text-xl font-light text-foreground/90">
              {brief.fallbackMessage}
            </p>
          </GlassCard>
        ) : null}

        {brief.fallbackMessage && cards.length > 0 && cards.length < 3 && (
          <p className="mt-6 text-center text-sm text-muted">
            {brief.fallbackMessage}
          </p>
        )}
      </GlassCard>
    </motion.section>
  );
}
