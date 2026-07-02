"use client";

import { motion } from "framer-motion";
import { larryBuckley } from "../data";
import { easeLuxury, fadeUp } from "../motion";
import { AmbientGlow } from "../ui/ambient";
import { Reveal, Section } from "../ui/section";

export function BecomeAMember() {
  const { firstName } = larryBuckley;

  return (
    <Section id="join" className="!pb-32 sm:!pb-40">
      <div className="relative overflow-hidden rounded-[2.5rem] border border-border bg-surface px-8 py-20 sm:px-16 sm:py-28 lg:px-24 lg:py-36">
        <AmbientGlow />

        <div className="relative text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.12 } },
            }}
          >
            <motion.p
              variants={fadeUp}
              className="text-[11px] font-medium uppercase tracking-[0.38em] text-accent"
            >
              Become A Member
            </motion.p>

            <motion.h2
              variants={fadeUp}
              className="mx-auto mt-6 max-w-3xl font-serif text-4xl font-light leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-6xl"
            >
              {firstName}, your home is ready for Preferred Care.
            </motion.h2>

            <motion.p
              variants={fadeUp}
              className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-muted sm:text-lg"
            >
              Join the homeowners who protect what matters most — with a team
              that knows their property by name, by detail, by heart.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-12 sm:mt-14">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.35, ease: easeLuxury }}
                className="group relative overflow-hidden rounded-full border border-accent/40 bg-accent px-12 py-5 sm:px-16 sm:py-6"
              >
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/25 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <span className="relative text-sm font-medium tracking-[0.18em] text-background sm:text-base">
                  Begin Preferred Care
                </span>
              </motion.button>
            </motion.div>

            <motion.p
              variants={fadeUp}
              className="mt-8 text-[11px] uppercase tracking-[0.3em] text-muted"
            >
              No commitment until you&apos;re ready
            </motion.p>
          </motion.div>
        </div>
      </div>

      <Reveal className="mt-20 text-center">
        <p className="font-serif text-lg font-light tracking-[0.2em] text-muted/60">
          SqueegeeOS
        </p>
        <p className="mt-2 text-[10px] uppercase tracking-[0.4em] text-muted/40">
          Crafted for {larryBuckley.fullName}
        </p>
      </Reveal>
    </Section>
  );
}
