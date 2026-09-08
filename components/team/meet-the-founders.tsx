"use client";

import { CUSTOMER_BRAND } from "@/lib/brand/customer";
import type { FounderProfile } from "@/lib/team/types";
import {
  SQUEEGEEKING_FOUNDERS,
  SQUEEGEEKING_TEAM_LEADS,
} from "@/lib/team/founders";
import { FounderProfileCard } from "./founder-profile-card";

interface MeetTheFoundersProps {
  id?: string;
  eyebrow?: string;
  title?: string;
  lead?: string;
  founders?: FounderProfile[];
  teamLeads?: FounderProfile[];
  footerLine?: string;
  className?: string;
  embedded?: boolean;
}

export function MeetTheFounders({
  id = "founders",
  eyebrow = "Leadership",
  title = "Meet your team.",
  lead = `Founder-led and built in Chico — ${CUSTOMER_BRAND.name} is the real story of two friends committed to premium home care, long-term relationships, and a standard you can trust.`,
  founders = SQUEEGEEKING_FOUNDERS,
  teamLeads = SQUEEGEEKING_TEAM_LEADS,
  footerLine,
  className = "",
  embedded = false,
}: MeetTheFoundersProps) {
  const content = (
    <>
      <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-accent">
        {eyebrow}
      </p>
      <h2 className="mt-5 max-w-2xl font-serif text-[2rem] font-light leading-tight text-foreground sm:text-5xl">
        {title}
      </h2>
      <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted sm:text-lg">
        {lead}
      </p>

      <div
        role="group"
        aria-label="Company leadership"
        className="mt-14 grid grid-cols-1 items-start gap-8 sm:mt-16 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:gap-10"
      >
        {founders.map((founder, index) => (
          <FounderProfileCard
            key={founder.id}
            founder={founder}
            priority={index === 0 && !embedded}
          />
        ))}
      </div>

      {teamLeads.length > 0 && (
        <div
          role="group"
          aria-label="Team leads"
          className="mx-auto mt-12 w-full max-w-[88%] border-t border-border pt-10 sm:mt-14 sm:max-w-4xl sm:pt-12"
        >
          <p className="text-center text-[10px] font-medium uppercase tracking-[0.32em] text-accent">
            Team leads
          </p>
          <p className="mx-auto mt-3 max-w-lg text-center text-sm leading-relaxed text-muted">
            From your first conversation to the finishing touches, meet the people leading your care.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8">
            {teamLeads.map((member) => (
              <FounderProfileCard key={member.id} founder={member} compact />
            ))}
          </div>
        </div>
      )}

      {footerLine && (
        <p className="mt-14 text-center font-serif text-lg font-light italic text-muted sm:mt-16">
          {footerLine}
        </p>
      )}
    </>
  );

  if (embedded) {
    return (
      <div id={id} className={className}>
        {content}
      </div>
    );
  }

  return (
    <section
      id={id}
      className={`border-t border-border bg-surface/30 px-5 py-28 sm:px-10 sm:py-36 lg:px-16 ${className}`}
    >
      <div className="mx-auto max-w-6xl">{content}</div>
    </section>
  );
}
