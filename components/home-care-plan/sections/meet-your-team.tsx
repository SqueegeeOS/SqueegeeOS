"use client";

import type { HomeCarePlanData } from "@/lib/home-care-plan/types";
import { MeetTheFounders } from "@/components/team/meet-the-founders";
import { SQUEEGEEKING_FOUNDERS } from "@/lib/team/founders";
import { CraftedLine, Reveal, Section } from "../ui/primitives";

export function MeetYourTeam({ data }: { data: HomeCarePlanData }) {
  return (
    <Section id="founders" className="bg-surface/30">
      <Reveal>
        <MeetTheFounders
          embedded
          founders={SQUEEGEEKING_FOUNDERS}
          lead="Your Home Care Plan is founder-led — built by Noah and Dasan in Chico, with a premium standard behind every visit, every detail, and every relationship."
          footerLine="Founded in Chico. Built on trust. Maintained through consistency."
        />
      </Reveal>
      <Reveal delay={0.1} className="mt-14 text-center sm:mt-16">
        <CraftedLine text={`Crafted for ${data.homeowner.fullName}`} />
      </Reveal>
    </Section>
  );
}
