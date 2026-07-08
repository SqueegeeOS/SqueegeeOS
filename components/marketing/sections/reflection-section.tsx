"use client";

import { AmbientLight } from "@/components/craft/ambient-light";
import { ScrollReveal } from "@/components/scroll-cinema/scroll-reveal";

export function ReflectionSection() {
  return (
    <section className="relative overflow-hidden bg-[#060606] py-24 sm:py-32">
      <AmbientLight variant="section" />
      <AmbientLight variant="dawn" className="opacity-80" />

      <div className="relative mx-auto max-w-[900px] px-5 sm:px-6">
        <ScrollReveal direction="fade">
          <p className="text-center font-serif text-[11px] uppercase tracking-[0.2em] text-accent/70 sm:text-sm">
            The standard of care your home deserves
          </p>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={120}>
          <p className="mt-16 text-center font-serif text-3xl font-light leading-snug text-[#f5f2eb] sm:mt-20 sm:text-4xl">
            Every surface. Every season.
            <br />
            <em className="text-accent/90">Without a single call from you.</em>
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
