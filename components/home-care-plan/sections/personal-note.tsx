"use client";

import type { HomeCarePlanData } from "@/lib/home-care-plan/canyon-oaks";
import { CraftedLine, Reveal, Section } from "../ui/primitives";

export function PersonalNote({ data }: { data: HomeCarePlanData }) {
  const { personalNote } = data;

  return (
    <Section id="note" className="!py-20 sm:!py-32">
      <Reveal>
        <div className="mx-auto max-w-xl rounded-[1.5rem] border border-border bg-surface/50 px-6 py-10 sm:rounded-[2rem] sm:px-12 sm:py-14">
          <p className="plan-handwritten text-[1.75rem] leading-tight text-foreground/90 sm:text-4xl">
            {personalNote.greeting}
          </p>

          <div className="mt-6 space-y-5 sm:mt-8 sm:space-y-6">
            {personalNote.paragraphs.map((paragraph, index) => (
              <p
                key={index}
                className="plan-handwritten text-lg leading-relaxed text-foreground/80 sm:text-2xl sm:leading-relaxed"
              >
                {paragraph}
              </p>
            ))}
          </div>

          <div className="mt-10 sm:mt-12">
            <p className="plan-handwritten text-xl text-foreground sm:text-3xl">
              — {personalNote.signoff}
            </p>
            <p className="mt-3 text-[10px] uppercase tracking-[0.22em] text-muted sm:tracking-[0.26em]">
              {personalNote.title}, {personalNote.company}
            </p>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.08} className="mt-10 text-center sm:mt-12">
        <CraftedLine text={data.brand.craftedFor} />
      </Reveal>
    </Section>
  );
}
