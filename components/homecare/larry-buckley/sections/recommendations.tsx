"use client";

import { larryBuckley } from "../data";
import {
  Reveal,
  Section,
  SectionEyebrow,
  SectionLead,
  SectionTitle,
} from "../ui/section";

export function Recommendations() {
  const { recommendations } = larryBuckley;

  return (
    <Section id="recommendations" className="bg-surface/30">
      <Reveal>
        <SectionEyebrow>Recommendations</SectionEyebrow>
      </Reveal>

      <Reveal delay={0.08} className="mt-6">
        <SectionTitle>Written for your home.</SectionTitle>
      </Reveal>

      <Reveal delay={0.16} className="mt-8">
        <SectionLead>
          Three priorities we believe will protect your investment this year —
          sequenced by urgency, not upsell.
        </SectionLead>
      </Reveal>

      <div className="mt-16 space-y-5 lg:mt-20">
        {recommendations.map((rec, index) => (
          <Reveal key={rec.title} delay={0.1 + index * 0.08}>
            <article className="group rounded-3xl border border-border bg-surface p-8 transition-colors duration-500 hover:border-accent/20 sm:p-10 lg:p-12">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
                <div className="flex-1">
                  <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-accent">
                    {rec.priority}
                  </p>
                  <h3 className="mt-4 font-serif text-3xl font-light tracking-tight text-foreground sm:text-4xl">
                    {rec.title}
                  </h3>
                  <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
                    {rec.description}
                  </p>
                </div>
                <div className="shrink-0 lg:pt-2 lg:text-right">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-muted">
                    Estimated Investment
                  </p>
                  <p className="mt-2 font-serif text-2xl font-light text-foreground">
                    {rec.investment}
                  </p>
                </div>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
