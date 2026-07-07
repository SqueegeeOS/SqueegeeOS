"use client";

import { AmbientLight } from "@/components/craft/ambient-light";
import { CUSTOMER_BRAND } from "@/lib/brand/customer";
import { GlassCard } from "@/components/scroll-cinema/glass-card";
import { ParallaxLayer } from "@/components/scroll-cinema/parallax-layer";
import { ScrollReveal } from "@/components/scroll-cinema/scroll-reveal";
import { Eyebrow } from "@/components/marketing/ui";

const pillars = [
  {
    title: "Personalized",
    description:
      "Every plan is written for your home — not a template, not a generic estimate.",
  },
  {
    title: "Proactive",
    description:
      "We remember the seasons, the details, and the maintenance your home deserves.",
  },
  {
    title: "Premium",
    description:
      "Luxury stewardship for homeowners who expect more than a service call.",
  },
] as const;

export function ServicesSection() {
  return (
    <section className="relative overflow-hidden bg-background px-5 py-28 sm:px-10 sm:py-36 lg:px-16">
      <AmbientLight variant="section" />
      <div className="relative mx-auto max-w-6xl">
        <ScrollReveal>
          <Eyebrow>What we do</Eyebrow>
          <h2 className="mt-6 max-w-2xl font-serif text-4xl font-light leading-tight text-foreground sm:text-5xl">
            Three pillars of {CUSTOMER_BRAND.name} care.
          </h2>
        </ScrollReveal>

        <div className="mt-16 grid gap-6 sm:grid-cols-3 sm:gap-8">
          {pillars.map((pillar, index) => (
            <ParallaxLayer key={pillar.title} depth={0.08 + index * 0.04}>
              <ScrollReveal delay={index * 100}>
                <GlassCard className="h-full">
                  <h3 className="font-serif text-2xl font-light text-foreground">
                    {pillar.title}
                  </h3>
                  <p className="mt-4 text-sm leading-relaxed text-muted">
                    {pillar.description}
                  </p>
                </GlassCard>
              </ScrollReveal>
            </ParallaxLayer>
          ))}
        </div>
      </div>
    </section>
  );
}
