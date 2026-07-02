"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { sampleHomeCarePlanPath } from "@/lib/acquisition/types";
import { MeetTheFounders } from "@/components/team/meet-the-founders";
import { AmbientGlow, Eyebrow, Reveal, easeLuxury } from "./ui";

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
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background">
      <AmbientGlow />

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

        <header className="relative z-10 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-10">
          <p className="font-serif text-lg font-light tracking-[0.2em] text-foreground/90 sm:text-xl">
            Squeegeeking
          </p>
        </header>

        <div className="relative z-10 flex flex-1 flex-col justify-end px-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-10 sm:pb-16 lg:px-16">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: easeLuxury, delay: 0.2 }}
          >
            <Eyebrow>Premium Home Care</Eyebrow>
            <h1 className="mt-6 max-w-[12ch] font-serif text-[2.5rem] font-light leading-[1.02] tracking-tight text-foreground sm:max-w-3xl sm:text-6xl lg:text-7xl">
              Protect what matters most.
            </h1>
            <p className="mt-6 max-w-md text-[0.9375rem] leading-relaxed text-foreground/75 sm:mt-8 sm:max-w-xl sm:text-lg">
              A personalized Home Care Plan for your property — crafted with the
              same care you bring to your home.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:mt-12 sm:max-w-md">
              <Link
                href="/request"
                className="flex min-h-[52px] items-center justify-center rounded-full border border-accent/40 bg-accent px-8 text-sm font-medium tracking-[0.14em] text-background touch-manipulation sm:text-base"
              >
                Request Your Personalized Home Care Plan
              </Link>
              <Link
                href={sampleHomeCarePlanPath}
                className="flex min-h-[52px] items-center justify-center rounded-full border border-border bg-surface/80 px-8 text-sm font-medium tracking-[0.12em] text-foreground backdrop-blur-sm touch-manipulation sm:text-base"
              >
                View Sample Home Care Plan
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="px-5 py-24 sm:px-10 sm:py-32 lg:px-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <Eyebrow>The Squeegeeking Difference</Eyebrow>
            <h2 className="mt-5 font-serif text-[2rem] font-light leading-tight text-foreground sm:text-5xl">
              Not contractor software.
              <br />
              A relationship with your home.
            </h2>
          </Reveal>

          <div className="mt-14 space-y-12 sm:mt-20 sm:grid sm:grid-cols-3 sm:gap-10 sm:space-y-0">
            {pillars.map((pillar, index) => (
              <Reveal key={pillar.title} delay={0.08 * index}>
                <article>
                  <h3 className="font-serif text-2xl font-light text-foreground">
                    {pillar.title}
                  </h3>
                  <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
                    {pillar.description}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <MeetTheFounders
        lead="Two friends building Squeegeeking in Chico — committed to premium exterior home care, long-term relationships, and a standard you can feel on every visit."
        footerLine="Authentic. Founder-led. Built in Chico, California."
      />

      <section className="border-t border-border px-5 py-20 text-center sm:py-28">
        <Reveal>
          <p className="font-serif text-2xl font-light text-foreground sm:text-3xl">
            Ready to begin?
          </p>
          <p className="mx-auto mt-4 max-w-md text-sm text-muted sm:text-base">
            Request your plan. We inspect your property. You receive a
            personalized experience — not a quote.
          </p>
          <Link
            href="/request"
            className="mt-8 inline-flex min-h-[52px] items-center justify-center rounded-full border border-accent/40 bg-accent px-10 text-sm font-medium tracking-[0.14em] text-background"
          >
            Request Your Personalized Home Care Plan
          </Link>
        </Reveal>
      </section>

      <footer className="border-t border-border px-5 py-12 text-center text-sm text-muted">
        <p className="font-serif text-lg text-foreground">Squeegeeking</p>
        <p className="mt-1">Premium Home Care · Chico, California</p>
        <Link href="/employee" className="mt-6 inline-block text-[10px] uppercase tracking-[0.3em] text-muted/50">
          Team Login
        </Link>
      </footer>
    </div>
  );
}
