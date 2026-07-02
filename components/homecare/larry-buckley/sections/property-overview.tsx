"use client";

import { larryBuckley } from "../data";
import {
  Reveal,
  Section,
  SectionEyebrow,
  SectionLead,
  SectionTitle,
} from "../ui/section";

const stats = [
  { label: "Year Built", value: String(larryBuckley.property.yearBuilt) },
  { label: "Square Feet", value: larryBuckley.property.squareFeet.toLocaleString() },
  {
    label: "Bedrooms",
    value: String(larryBuckley.property.bedrooms),
  },
  {
    label: "Bathrooms",
    value: String(larryBuckley.property.bathrooms),
  },
  { label: "Lot Size", value: larryBuckley.property.lotSize },
  { label: "Last Inspection", value: larryBuckley.property.lastInspection },
];

export function PropertyOverview() {
  const { property } = larryBuckley;

  return (
    <Section id="property">
      <Reveal>
        <SectionEyebrow>Your Property</SectionEyebrow>
      </Reveal>

      <Reveal delay={0.08} className="mt-6">
        <SectionTitle>{property.style}</SectionTitle>
      </Reveal>

      <Reveal delay={0.16} className="mt-8">
        <SectionLead>{property.narrative}</SectionLead>
      </Reveal>

      <div className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-3 lg:mt-20">
        {stats.map((stat, index) => (
          <Reveal key={stat.label} delay={0.1 + index * 0.05}>
            <div className="flex flex-col justify-center bg-surface px-6 py-8 sm:px-8 sm:py-10">
              <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-muted">
                {stat.label}
              </p>
              <p className="mt-3 font-serif text-2xl font-light tracking-tight text-foreground sm:text-3xl">
                {stat.value}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
