"use client";

import {
  SQUEEGEEKING_TIERS,
  calculateVisitPrice,
  formatTierPrice,
} from "@/lib/membership/tier-config";
import { AmbientBackground } from "@/components/scroll-cinema/ambient-background";
import { CountUp } from "@/components/scroll-cinema/count-up";
import { GlassCard } from "@/components/scroll-cinema/glass-card";
import { ScrollReveal } from "@/components/scroll-cinema/scroll-reveal";
import { Eyebrow } from "@/components/marketing/ui";

const demoSqft = 2500;

const tiers = (["biannual", "quarterly"] as const).map((id) => ({
  ...SQUEEGEEKING_TIERS[id],
  visitPrice: calculateVisitPrice(id, demoSqft),
}));

export function MembershipSection() {
  return (
    <section className="relative overflow-hidden bg-[#060606] px-5 py-28 sm:px-10 sm:py-36">
      <AmbientBackground />
      <div className="relative mx-auto max-w-6xl">
        <ScrollReveal>
          <Eyebrow>SqueegeeKing Membership</Eyebrow>
          <h2 className="mt-6 font-serif text-4xl font-light text-[#f5f2eb] sm:text-5xl">
            Consistent care or total protection.
          </h2>
          <p className="mt-4 max-w-xl text-sm text-white/50">
            Two tiers. Same workmanship guarantee. Bi-Annual includes 20% OFF
            add-ons; Quarterly adds RainBlock + Hard Water and 25% OFF — example
            pricing for {demoSqft.toLocaleString()} sq ft.
          </p>
        </ScrollReveal>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {tiers.map((tier, index) => (
            <ScrollReveal key={tier.id} delay={index * 120}>
              <GlassCard
                className={
                  tier.highlighted
                    ? "border-accent/30 bg-accent/[0.06]"
                    : ""
                }
              >
                {tier.highlighted && (
                  <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-accent">
                    Recommended · {tier.premiumBadge}
                  </p>
                )}
                <p className="text-[10px] uppercase tracking-[0.22em] text-accent/80">
                  {tier.tagline}
                </p>
                <p className="mt-2 font-serif text-2xl text-foreground">
                  {tier.label}
                </p>
                <p className="mt-4 font-serif text-4xl font-light text-foreground">
                  <CountUp value={tier.visitPrice} prefix="$" suffix="/visit" />
                </p>
                <p className="mt-2 text-xs text-muted">
                  {tier.visitsPerYear} visits · {tier.frequency}
                </p>
                <ul className="mt-4 space-y-1.5 text-xs text-muted">
                  {tier.benefits.slice(0, 4).map((b) => (
                    <li key={b}>◈ {b}</li>
                  ))}
                </ul>
              </GlassCard>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal delay={300}>
          <p className="mt-10 text-center text-sm text-white/40">
            Quarterly from {formatTierPrice(tiers[1].visitPrice)}/visit ·{" "}
            <a href="/request" className="text-accent hover:underline">
              Request your personalized plan
            </a>
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
