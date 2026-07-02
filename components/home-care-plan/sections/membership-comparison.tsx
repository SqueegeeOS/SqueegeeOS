"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { HomeCarePlanData } from "@/lib/home-care-plan/canyon-oaks";
import { easePlan } from "../ui/primitives";
import { Eyebrow, Reveal, Section, SectionTitle } from "../ui/primitives";

export function MembershipComparison({ data }: { data: HomeCarePlanData }) {
  const reduceMotion = useReducedMotion();

  return (
    <Section id="membership" className="bg-surface/30">
      <Reveal>
        <Eyebrow>Membership</Eyebrow>
        <SectionTitle className="mt-5 sm:mt-6">
          Choose how you want to live.
        </SectionTitle>
        <p className="mt-6 max-w-xl text-[0.9375rem] leading-relaxed text-muted sm:mt-8 sm:text-lg">
          Not a list of services — a way of caring for Canyon Oaks.
        </p>
      </Reveal>

      <div className="mt-14 flex flex-col gap-6 sm:mt-20 lg:mt-24 lg:grid lg:grid-cols-3 lg:items-stretch lg:gap-8">
        {data.memberships.map((tier, index) => (
          <Reveal key={tier.id} delay={0.08 * index}>
            <motion.article
              whileHover={
                reduceMotion ? undefined : tier.highlighted ? { y: -4 } : { y: -2 }
              }
              transition={{ duration: 0.45, ease: easePlan }}
              className={`relative flex w-full flex-col justify-between rounded-[1.75rem] p-8 sm:p-10 ${
                tier.highlighted
                  ? "mt-2 border border-accent/40 bg-gradient-to-b from-accent/[0.12] to-surface shadow-[0_0_80px_-30px_rgba(201,184,150,0.28)] lg:scale-[1.04] lg:py-12"
                  : "border border-border bg-surface"
              }`}
            >
              {tier.highlighted && "badge" in tier && (
                <div className="mb-2 flex justify-center lg:absolute lg:-top-3.5 lg:left-1/2 lg:mb-0 lg:-translate-x-1/2">
                  <span className="whitespace-nowrap rounded-full border border-accent/30 bg-background px-4 py-1.5 text-[10px] font-medium uppercase tracking-[0.22em] text-accent">
                    ★ {tier.badge}
                  </span>
                </div>
              )}

              <div>
                <p
                  className={`text-[10px] font-medium uppercase tracking-[0.28em] sm:tracking-[0.32em] ${
                    tier.highlighted ? "text-accent" : "text-muted"
                  }`}
                >
                  {tier.name}
                </p>

                <div className="mt-6 flex flex-wrap items-baseline gap-x-2 gap-y-1 sm:mt-8">
                  <span
                    className={`font-serif font-light tracking-tight text-foreground ${
                      tier.highlighted ? "text-4xl sm:text-5xl" : "text-3xl sm:text-4xl"
                    }`}
                  >
                    {tier.price}
                  </span>
                  <span className="text-sm text-muted">{tier.period}</span>
                </div>

                <p className="mt-6 text-[0.9375rem] leading-relaxed text-foreground/80 sm:mt-8 sm:text-lg sm:leading-relaxed">
                  {tier.lifestyle}
                </p>
              </div>
            </motion.article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
