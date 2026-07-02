"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import type { HomeCarePlanData } from "@/lib/home-care-plan/canyon-oaks";
import { easePlan } from "../ui/primitives";
import { Eyebrow, Reveal, Section, SectionTitle } from "../ui/primitives";

export function WhatWeFound({ data }: { data: HomeCarePlanData }) {
  const reduceMotion = useReducedMotion();

  return (
    <Section id="findings" className="bg-surface/30">
      <Reveal>
        <Eyebrow>What We Found</Eyebrow>
        <SectionTitle className="mt-5 sm:mt-6">
          Five observations from your inspection.
        </SectionTitle>
        <p className="mt-5 max-w-2xl text-[0.9375rem] leading-relaxed text-muted sm:mt-6 sm:text-lg">
          Not a checklist — a portrait of how Canyon Oaks lives through the
          seasons.
        </p>
      </Reveal>

      <div className="mt-14 space-y-10 sm:mt-20 sm:space-y-14 lg:space-y-16">
        {data.findings.map((finding, index) => (
          <Reveal key={finding.id} delay={0.06 * index}>
            <motion.article
              whileHover={reduceMotion ? undefined : { y: -2 }}
              transition={{ duration: 0.45, ease: easePlan }}
              className="group w-full overflow-hidden rounded-[1.5rem] border border-border bg-surface sm:rounded-[1.75rem] lg:flex"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden sm:aspect-[16/10] lg:aspect-auto lg:min-h-[280px] lg:w-[42%] lg:shrink-0">
                <Image
                  src={finding.image}
                  alt={finding.title}
                  fill
                  className="object-cover transition-transform duration-[1.2s] ease-out group-active:scale-[1.02] sm:group-hover:scale-[1.03]"
                  sizes="(max-width: 1024px) 100vw, 480px"
                />
              </div>

              <div className="flex flex-1 flex-col justify-center p-6 sm:p-9 lg:p-11">
                <p className="text-[10px] font-medium uppercase tracking-[0.26em] text-accent sm:tracking-[0.3em]">
                  {finding.severity}
                </p>
                <h3 className="mt-3 font-serif text-2xl font-light tracking-tight text-foreground sm:mt-4 sm:text-3xl lg:text-4xl">
                  {finding.title}
                </h3>
                <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted sm:mt-5 sm:text-base sm:leading-relaxed">
                  {finding.description}
                </p>
              </div>
            </motion.article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
