"use client";

import type { HomeCarePlanData } from "@/lib/home-care-plan/canyon-oaks";
import { Eyebrow, Reveal, Section, SectionTitle } from "../ui/primitives";

export function PropertySnapshot({ data }: { data: HomeCarePlanData }) {
  return (
    <Section id="snapshot">
      <Reveal>
        <Eyebrow>Property Health</Eyebrow>
        <p className="mt-6 font-serif text-4xl font-light tracking-tight text-foreground sm:mt-8 sm:text-6xl lg:text-7xl">
          {data.propertyHealth.rating}
        </p>
        <p className="mt-8 max-w-2xl text-[0.9375rem] leading-[1.8] text-foreground/75 sm:mt-10 sm:text-lg sm:leading-[1.85] lg:text-xl">
          {data.propertyHealth.narrative}
        </p>
      </Reveal>

      <Reveal delay={0.1} className="mt-20 sm:mt-28">
        <Eyebrow>What We Know About Your Home</Eyebrow>
        <SectionTitle className="mt-5 sm:mt-6">Canyon Oaks, at a glance.</SectionTitle>
      </Reveal>

      <div className="mt-12 grid grid-cols-1 gap-5 sm:mt-16 sm:grid-cols-2 sm:gap-6 lg:mt-20 lg:grid-cols-3 lg:gap-8">
        {data.propertyProfile.map((item, index) => (
          <Reveal key={item.label} delay={0.04 * index}>
            <article className="flex h-full flex-col rounded-3xl border border-border bg-surface p-7 sm:p-9">
              <p className="text-[10px] font-medium uppercase tracking-[0.26em] text-muted sm:tracking-[0.3em]">
                {item.label}
              </p>
              <p className="mt-4 font-serif text-2xl font-light tracking-tight text-foreground sm:mt-5 sm:text-3xl">
                {item.value}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted sm:mt-4">
                {item.detail}
              </p>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
