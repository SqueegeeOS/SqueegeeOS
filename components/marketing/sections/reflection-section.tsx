"use client";

import Image from "next/image";
import { ReflectionMirror } from "@/components/scroll-cinema/reflection-mirror";
import { ScrollReveal } from "@/components/scroll-cinema/scroll-reveal";
import { HERO_IMAGE } from "./hero-section";

export function ReflectionSection() {
  return (
    <section className="relative overflow-hidden bg-[#060606] py-24 sm:py-32">
      <div className="mx-auto max-w-[900px] px-5 sm:px-6">
        <ScrollReveal direction="fade">
          <p className="text-center font-serif text-[11px] uppercase tracking-[0.2em] text-accent/70 sm:text-sm">
            The standard of care your home deserves
          </p>
        </ScrollReveal>

        <div className="mt-12">
          <ReflectionMirror intensity={0.38} blurPx={10}>
            <div className="overflow-hidden rounded-sm">
              <Image
                src={HERO_IMAGE}
                alt="HomeAtlas property care"
                width={900}
                height={560}
                className="block h-auto w-full"
              />
            </div>
          </ReflectionMirror>
        </div>

        <ScrollReveal direction="up" delay={200}>
          <p className="mt-16 text-center font-serif text-3xl font-light leading-snug text-[#f5f2eb] sm:text-4xl">
            Every surface. Every season.
            <br />
            <em className="text-accent/90">Without a single call from you.</em>
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
