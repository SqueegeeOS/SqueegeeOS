"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useState } from "react";
import { larryBuckley } from "../data";
import { easeLuxury } from "../motion";
import {
  Reveal,
  Section,
  SectionEyebrow,
  SectionLead,
  SectionTitle,
} from "../ui/section";

export function InspectionGallery() {
  const { inspections } = larryBuckley;
  const [active, setActive] = useState(0);

  return (
    <Section id="inspections">
      <Reveal>
        <SectionEyebrow>Inspection Gallery</SectionEyebrow>
      </Reveal>

      <Reveal delay={0.08} className="mt-6">
        <SectionTitle>Every detail, documented.</SectionTitle>
      </Reveal>

      <Reveal delay={0.16} className="mt-8">
        <SectionLead>
          A visual record from your most recent visit — captured with the same
          care we bring to your home.
        </SectionLead>
      </Reveal>

      <div className="mt-16 lg:mt-20">
        <Reveal delay={0.1}>
          <div className="relative aspect-[16/10] overflow-hidden rounded-[2rem] border border-border">
            <motion.div
              key={inspections[active].id}
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, ease: easeLuxury }}
              className="absolute inset-0"
            >
              <Image
                src={inspections[active].image}
                alt={inspections[active].title}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 1152px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            </motion.div>

            <div className="absolute bottom-0 left-0 right-0 p-8 sm:p-12">
              <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-accent">
                {inspections[active].title}
              </p>
              <p className="mt-3 max-w-xl text-base leading-relaxed text-foreground/85 sm:text-lg">
                {inspections[active].caption}
              </p>
            </div>
          </div>
        </Reveal>

        <div className="mt-6 grid grid-cols-5 gap-3 sm:gap-4">
          {inspections.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActive(index)}
              className={`group relative aspect-[4/3] overflow-hidden rounded-2xl border transition-all duration-500 ${
                active === index
                  ? "border-accent/50 ring-1 ring-accent/30"
                  : "border-border opacity-60 hover:opacity-100"
              }`}
            >
              <Image
                src={item.image}
                alt={item.title}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                sizes="200px"
              />
            </button>
          ))}
        </div>
      </div>
    </Section>
  );
}
