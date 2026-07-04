"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { CUSTOMER_BRAND, CUSTOMER_CTAS } from "@/lib/brand/customer";
import { sampleHomeCarePlanPath } from "@/lib/acquisition/types";
import { MeetTheFounders } from "@/components/team/meet-the-founders";
import { CursorSpotlightPage } from "@/components/motion/cursor-spotlight";
import { Eyebrow, Reveal, easeLuxury } from "./ui";

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

export function PublicLanding() {
  const reduceMotion = useReducedMotion();

  return (
    <CursorSpotlightPage intensity="bright">
      <section className="relative flex min-h-[100svh] flex-col">
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1920&q=85"
            alt=""
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-background" />
        </div>

        <div className="relative z-10 flex flex-1 flex-col justify-end px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[var(--site-nav-height)] sm:px-10 sm:pb-20 lg:px-16">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: easeLuxury, delay: reduceMotion ? 0 : 0.15 }}
          >
            <Eyebrow>Premium Home Care</Eyebrow>
            <h1 className="mt-6 max-w-[12ch] font-serif text-[2.5rem] font-light leading-[1.04] tracking-tight text-foreground sm:max-w-3xl sm:text-6xl lg:text-7xl">
              Protect what matters most.
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-foreground/75 sm:mt-8 sm:max-w-xl sm:text-lg sm:leading-relaxed">
              A personalized Home Care Plan for your property — crafted with the
              same care you bring to your home.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:mt-12 sm:max-w-sm">
              <div className="text-center sm:text-left">
                <Link
                  href="/request"
                  className="flex min-h-[52px] items-center justify-center rounded-full border border-accent/40 bg-accent px-8 text-sm font-medium tracking-[0.12em] text-background touch-manipulation transition-opacity hover:opacity-95 sm:text-base"
                >
                  {CUSTOMER_CTAS.requestPlan}
                </Link>
                <p className="mt-2.5 text-[11px] tracking-[0.14em] text-foreground/55">
                  {CUSTOMER_CTAS.requestPlanHint}
                </p>
              </div>
              <Link
                href={sampleHomeCarePlanPath}
                className="flex min-h-[52px] items-center justify-center rounded-full border border-border bg-surface/80 px-8 text-sm font-medium tracking-[0.1em] text-foreground backdrop-blur-sm touch-manipulation transition-colors hover:border-accent/30 sm:text-base"
              >
                {CUSTOMER_CTAS.samplePlan}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="px-5 py-28 sm:px-10 sm:py-36 lg:px-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <Eyebrow>The {CUSTOMER_BRAND.name} Difference</Eyebrow>
            <h2 className="mt-6 font-serif text-[2rem] font-light leading-[1.08] tracking-tight text-foreground sm:text-5xl">
              Not contractor software.
              <br />
              A relationship with your home.
            </h2>
          </Reveal>

          <div className="mt-16 space-y-14 sm:mt-24 sm:grid sm:grid-cols-3 sm:gap-12 sm:space-y-0">
            {pillars.map((pillar, index) => (
              <Reveal key={pillar.title} delay={0.08 * index}>
                <article>
                  <h3 className="font-serif text-2xl font-light text-foreground sm:text-3xl">
                    {pillar.title}
                  </h3>
                  <p className="mt-4 text-sm leading-relaxed text-muted sm:mt-5 sm:text-base sm:leading-relaxed">
                    {pillar.description}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <MeetTheFounders
        lead={`Two friends building ${CUSTOMER_BRAND.name} in ${CUSTOMER_BRAND.location} — committed to premium exterior home care, long-term relationships, and a standard you can feel on every visit.`}
        footerLine={`Authentic. Founder-led. Built in ${CUSTOMER_BRAND.location}.`}
      />

      <section className="border-t border-border px-5 py-24 text-center sm:py-32">
        <Reveal>
          <p className="font-serif text-2xl font-light text-foreground sm:text-3xl">
            Ready to begin?
          </p>
          <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-muted sm:text-base">
            Request your plan. We inspect your property. You receive a
            personalized experience — not a quote.
          </p>
          <div className="mt-10">
            <Link
              href="/request"
              className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-accent/40 bg-accent px-10 text-sm font-medium tracking-[0.12em] text-background transition-opacity hover:opacity-95"
            >
              {CUSTOMER_CTAS.requestPlan}
            </Link>
            <p className="mt-2.5 text-[11px] tracking-[0.14em] text-muted">
              {CUSTOMER_CTAS.requestPlanHint}
            </p>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-border px-5 py-14 text-center text-sm text-muted sm:py-16">
        <p className="font-serif text-lg text-foreground">{CUSTOMER_BRAND.name}</p>
        <p className="mt-2">
          {CUSTOMER_BRAND.tagline} · {CUSTOMER_BRAND.location}
        </p>
        <Link
          href="/employee"
          className="mt-8 inline-block min-h-[44px] py-2 text-[10px] uppercase tracking-[0.28em] text-muted/50 transition-colors hover:text-muted"
        >
          Team Login
        </Link>
      </footer>
    </CursorSpotlightPage>
  );
}
