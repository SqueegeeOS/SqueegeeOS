"use client";

import type { HomeCarePlanData } from "@/lib/home-care-plan/canyon-oaks";
import { Eyebrow, Reveal, Section, SectionTitle } from "../ui/primitives";

export function MembershipBenefits({ data }: { data: HomeCarePlanData }) {
  return (
    <Section id="benefits">
      <Reveal>
        <Eyebrow>Membership</Eyebrow>
        <SectionTitle className="mt-6">
          Why homeowners choose membership.
        </SectionTitle>
      </Reveal>

      <div className="mt-20 grid gap-10 sm:grid-cols-2 lg:mt-24 lg:gap-12">
        {data.membershipBenefits.map((benefit, index) => (
          <Reveal key={benefit.title} delay={0.08 * index}>
            <article>
              <p className="font-serif text-2xl font-light tracking-tight text-foreground sm:text-3xl">
                {benefit.title}
              </p>
              <p className="mt-4 text-base leading-relaxed text-muted">
                {benefit.description}
              </p>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
