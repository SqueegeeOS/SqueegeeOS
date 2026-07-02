"use client";

import type { HomeCarePlanData } from "@/lib/home-care-plan/canyon-oaks";
import { Eyebrow, Reveal } from "../ui/primitives";

export function HomeCareJourney({ data }: { data: HomeCarePlanData }) {
  return (
    <section
      id="journey"
      className="relative border-y border-border bg-surface/20 py-24 sm:py-40 lg:py-52"
    >
      <div className="mx-auto max-w-3xl px-5 text-center sm:px-10">
        <Reveal>
          <Eyebrow>Your Home Care Journey</Eyebrow>
          <h2 className="mt-6 font-serif text-[2rem] font-light leading-[1.1] tracking-tight text-foreground sm:mt-8 sm:text-5xl">
            What the next year looks like.
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-[0.9375rem] leading-relaxed text-muted sm:mt-8 sm:text-lg">
            A relationship that deepens with every season — not a transaction
            that ends at the door.
          </p>
        </Reveal>

        <div className="relative mt-20 sm:mt-24">
          <div className="absolute bottom-8 left-1/2 top-8 w-px -translate-x-1/2 bg-gradient-to-b from-accent/40 via-border to-transparent" />

          <div className="space-y-16 sm:space-y-20">
            {data.careJourney.map((item, index) => (
              <Reveal key={item.step} delay={0.08 * index}>
                <div className="relative">
                  <div className="mx-auto mb-6 h-2.5 w-2.5 rounded-full border border-accent/50 bg-background" />
                  <h3 className="font-serif text-2xl font-light tracking-tight text-foreground sm:text-3xl">
                    {item.step}
                  </h3>
                  <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted sm:text-base">
                    {item.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
