"use client";

import { larryBuckley } from "../data";
import {
  Reveal,
  Section,
  SectionEyebrow,
  SectionLead,
  SectionTitle,
} from "../ui/section";

export function MembershipBenefits() {
  const { benefits } = larryBuckley;

  return (
    <Section id="benefits" className="bg-surface/30">
      <div className="grid gap-16 lg:grid-cols-2 lg:gap-24">
        <div>
          <Reveal>
            <SectionEyebrow>Why Membership</SectionEyebrow>
          </Reveal>

          <Reveal delay={0.08} className="mt-6">
            <SectionTitle>
              Not a contract.
              <br />
              A relationship.
            </SectionTitle>
          </Reveal>

          <Reveal delay={0.16} className="mt-8">
            <SectionLead>
              Membership means your home is never an afterthought. It&apos;s
              watched, documented, and cared for — season after season.
            </SectionLead>
          </Reveal>
        </div>

        <div className="space-y-8">
          {benefits.map((benefit, index) => (
            <Reveal key={benefit.title} delay={0.1 + index * 0.08}>
              <div className="border-l border-accent/30 pl-8">
                <h3 className="font-serif text-2xl font-light tracking-tight text-foreground sm:text-3xl">
                  {benefit.title}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-muted">
                  {benefit.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}
