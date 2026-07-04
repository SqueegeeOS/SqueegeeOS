"use client";

import Image from "next/image";
import { ParallaxLayer } from "@/components/scroll-cinema/parallax-layer";
import { ScrollReveal } from "@/components/scroll-cinema/scroll-reveal";
import { Eyebrow } from "@/components/marketing/ui";

const stories = [
  {
    quote:
      "We stopped chasing contractors. Our home just stays ready — windows, gutters, everything on rhythm.",
    name: "Larry B.",
    place: "Canyon Oaks",
    image:
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80",
  },
  {
    quote:
      "The member portal shows what's coming before I ask. That alone is worth the membership.",
    name: "Sarah M.",
    place: "Chico",
    image:
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80",
  },
  {
    quote:
      "Premium means they notice things we would miss — mineral buildup, mildew, small fixes before they grow.",
    name: "James T.",
    place: "Paradise",
    image:
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80",
  },
] as const;

export function TestimonialsSection() {
  return (
    <section className="border-t border-border bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-10">
        <ScrollReveal>
          <Eyebrow>Member stories</Eyebrow>
          <h2 className="mt-4 font-serif text-3xl font-light text-foreground sm:text-4xl">
            Homes that breathe easier.
          </h2>
        </ScrollReveal>

        <div className="mt-12 flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {stories.map((story, index) => (
            <article
              key={story.name}
              className="relative min-w-[min(85vw,340px)] shrink-0 snap-start overflow-hidden rounded-3xl border border-border bg-surface"
            >
              <div className="relative h-44">
                <Image
                  src={story.image}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="340px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              </div>
              <ParallaxLayer depth={0.06} className="px-6 py-6">
                <ScrollReveal delay={index * 80}>
                  <p className="font-serif text-lg font-light leading-relaxed text-foreground">
                    &ldquo;{story.quote}&rdquo;
                  </p>
                  <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-muted">
                    {story.name} · {story.place}
                  </p>
                </ScrollReveal>
              </ParallaxLayer>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
