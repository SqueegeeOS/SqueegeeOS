"use client";

import { AmbientBackground } from "@/components/scroll-cinema/ambient-background";
import { ScrollReveal } from "@/components/scroll-cinema/scroll-reveal";
import { SqueegeeKingTierComparison } from "@/components/membership/squeegeeking-tier-comparison";
import { Eyebrow } from "@/components/marketing/ui";

const demoSqft = 2500;

export function MembershipSection() {
  return (
    <section className="relative overflow-hidden bg-[#060606] px-5 py-28 sm:px-10 sm:py-36">
      <AmbientBackground />
      <div className="relative mx-auto max-w-4xl">
        <ScrollReveal>
          <Eyebrow>SqueegeeKing Membership</Eyebrow>
          <h2 className="mt-6 font-serif text-4xl font-light text-[#f5f2eb] sm:text-5xl">
            Consistent care or total protection.
          </h2>
          <p className="mt-4 max-w-xl text-sm text-white/50">
            Two tiers. Same workmanship guarantee. Example pricing for{" "}
            {demoSqft.toLocaleString()} sq ft — your plan is personalized after
            inspection.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={120}>
          <SqueegeeKingTierComparison
            squareFootage={demoSqft}
            variant="marketing"
            className="mt-14"
          />
        </ScrollReveal>
      </div>
    </section>
  );
}
