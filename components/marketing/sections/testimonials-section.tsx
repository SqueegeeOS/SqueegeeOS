"use client";

import { ScrollReveal } from "@/components/scroll-cinema/scroll-reveal";
import { Eyebrow } from "@/components/marketing/ui";

/** Shown until live Google reviews are connected — no fabricated quotes. */
export function TestimonialsSection() {
  return (
    <section className="border-t border-border bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-2xl px-5 text-center sm:px-10">
        <ScrollReveal>
          <Eyebrow>Member stories</Eyebrow>
          <h2 className="mt-4 font-serif text-3xl font-light text-foreground sm:text-4xl">
            Real reviews, soon.
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-muted sm:text-base">
            We don&apos;t publish placeholder testimonials. Once our Google
            reviews integration is live, member stories will appear here.
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
