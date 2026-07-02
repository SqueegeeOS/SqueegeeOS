"use client";

import { motion } from "framer-motion";
import { larryBuckley } from "../data";
import { easeLuxury } from "../motion";
import {
  Reveal,
  Section,
  SectionEyebrow,
  SectionLead,
  SectionTitle,
} from "../ui/section";

export function MembershipComparison() {
  const { memberships } = larryBuckley;

  return (
    <Section id="membership">
      <Reveal>
        <SectionEyebrow>Membership</SectionEyebrow>
      </Reveal>

      <Reveal delay={0.08} className="mt-6">
        <SectionTitle>Choose your level of care.</SectionTitle>
      </Reveal>

      <Reveal delay={0.16} className="mt-8">
        <SectionLead>
          Three tiers. One standard of excellence. Based on your home&apos;s age,
          condition, and character, we recommend Preferred Care.
        </SectionLead>
      </Reveal>

      <div className="mt-16 grid gap-6 lg:mt-20 lg:grid-cols-3 lg:gap-5 lg:items-stretch">
        {memberships.map((tier, index) => (
          <Reveal key={tier.id} delay={0.1 + index * 0.08}>
            <motion.article
              whileHover={tier.highlighted ? { y: -6 } : { y: -3 }}
              transition={{ duration: 0.4, ease: easeLuxury }}
              className={`relative flex h-full flex-col rounded-[2rem] p-8 sm:p-10 ${
                tier.highlighted
                  ? "border border-accent/40 bg-gradient-to-b from-accent/[0.12] to-surface shadow-[0_0_80px_-20px_rgba(201,184,150,0.25)] lg:scale-[1.03] lg:-my-4 lg:py-14"
                  : "border border-border bg-surface"
              }`}
            >
              {tier.highlighted && "badge" in tier && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-accent/30 bg-background px-5 py-1.5">
                  <span className="text-[10px] font-medium uppercase tracking-[0.28em] text-accent">
                    {tier.badge}
                  </span>
                </div>
              )}

              <p
                className={`text-[11px] font-medium uppercase tracking-[0.32em] ${
                  tier.highlighted ? "text-accent" : "text-muted"
                }`}
              >
                {tier.name}
              </p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="font-serif text-5xl font-light tracking-tight text-foreground">
                  ${tier.price}
                </span>
                <span className="text-sm text-muted">/ month</span>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-muted">
                {tier.description}
              </p>

              <div className="my-8 h-px bg-border" />

              <ul className="flex flex-1 flex-col gap-4">
                {tier.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 text-sm leading-relaxed text-foreground/85"
                  >
                    <span
                      className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${
                        tier.highlighted ? "bg-accent" : "bg-muted"
                      }`}
                    />
                    {feature}
                  </li>
                ))}
              </ul>
            </motion.article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
