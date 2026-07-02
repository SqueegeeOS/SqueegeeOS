"use client";

import { CUSTOMER_BRAND } from "@/lib/brand/customer";
import type { FounderProfile } from "@/lib/team/types";
import { SQUEEGEEKING_FOUNDERS } from "@/lib/team/founders";
import { FounderProfileCard } from "./founder-profile-card";

interface MeetTheFoundersProps {
  id?: string;
  eyebrow?: string;
  title?: string;
  lead?: string;
  founders?: FounderProfile[];
  footerLine?: string;
  className?: string;
  embedded?: boolean;
}

export function MeetTheFounders({
  id = "founders",
  eyebrow = "Leadership",
  title = "Meet the founders.",
  lead = `Founder-led and built in Chico — ${CUSTOMER_BRAND.name} is the real story of two friends committed to premium home care, long-term relationships, and a standard you can trust.`,
  founders = SQUEEGEEKING_FOUNDERS,
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

      <div className="mt-14 grid grid-cols-1 gap-8 sm:mt-16 lg:grid-cols-2 lg:gap-10">
        {founders.map((founder, index) => (
          <FounderProfileCard
            key={founder.id}
            founder={founder}
            priority={index === 0 && !embedded}
          />
        ))}
      </div>

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
