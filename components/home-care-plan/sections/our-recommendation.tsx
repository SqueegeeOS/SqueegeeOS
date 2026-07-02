"use client";

import type { HomeCarePlanData } from "@/lib/home-care-plan/canyon-oaks";
import { CraftedLine, Eyebrow, Reveal, Section, SectionTitle } from "../ui/primitives";

export function OurRecommendation({ data }: { data: HomeCarePlanData }) {
  const { recommendation } = data;

  return (
    <Section id="recommendation">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <Eyebrow>Our Recommendation</Eyebrow>
          <SectionTitle className="mt-6">{recommendation.headline}</SectionTitle>
        </Reveal>

        <div className="mt-12 space-y-8 sm:mt-16 sm:space-y-10">
          {recommendation.paragraphs.map((paragraph, index) => (
            <Reveal key={index} delay={0.1 + index * 0.08}>
              <p className="text-lg leading-[1.75] text-foreground/80 sm:text-xl sm:leading-[1.8]">
                {paragraph}
              </p>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.35} className="mt-14 sm:mt-16">
          <div className="border-l border-accent/30 pl-8 sm:pl-10">
            <p className="font-serif text-2xl font-light leading-relaxed text-foreground sm:text-3xl sm:leading-relaxed">
              {recommendation.closing}
            </p>
            <div className="mt-8">
              <CraftedLine text={data.brand.craftedFor} />
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
