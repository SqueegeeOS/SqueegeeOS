"use client";

import type { HomeCarePlanData } from "@/lib/home-care-plan/types";
import { SqueegeeKingTierComparison } from "@/components/membership/squeegeeking-tier-comparison";
import { Eyebrow, Reveal, Section, SectionTitle } from "../ui/primitives";

function resolveSquareFootage(data: HomeCarePlanData): number {
  const sqftRow = data.propertyProfile.find((row) =>
    /sq\.?\s*ft|square\s*feet/i.test(row.label),
  );
  if (sqftRow?.value) {
    const parsed = parseInt(sqftRow.value.replace(/\D/g, ""), 10);
    if (parsed > 0) return parsed;
  }
  return 2500;
}

export function MembershipComparison({ data }: { data: HomeCarePlanData }) {
  const squareFootage = resolveSquareFootage(data);

  return (
    <Section id="membership" className="bg-surface/30">
      <Reveal>
        <Eyebrow>Membership</Eyebrow>
        <SectionTitle className="mt-5 sm:mt-6">
          Choose how you want to live.
        </SectionTitle>
        <p className="mt-6 max-w-xl text-[0.9375rem] leading-relaxed text-muted sm:mt-8 sm:text-lg">
          Quarterly for year-round protection — or Bi-Annual for a consistent
          refresh. Same craftsmanship, different rhythm.
        </p>
      </Reveal>

      <Reveal delay={0.1}>
        <SqueegeeKingTierComparison
          squareFootage={squareFootage}
          variant="default"
          className="mt-14 sm:mt-20"
        />
      </Reveal>
    </Section>
  );
}
