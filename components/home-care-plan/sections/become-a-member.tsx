"use client";

import { motion } from "framer-motion";
import type { HomeCarePlanData } from "@/lib/home-care-plan/canyon-oaks";
import { fadeUp } from "../ui/primitives";
import { CraftedLine, Eyebrow, Reveal, Section } from "../ui/primitives";
import { PrimaryButton } from "../ui/primary-button";
import { useMembershipCheckout } from "@/components/membership/checkout-context";

export function BecomeAMember({ data }: { data: HomeCarePlanData }) {
  const { closing, brand } = data;
  const { openCheckout } = useMembershipCheckout();
  const telHref = `tel:${closing.phone.replace(/\D/g, "")}`;

  return (
    <>
      <Section id="join" className="!pb-28 sm:!pb-32">
        <div className="relative overflow-hidden rounded-[1.75rem] border border-accent/20 bg-gradient-to-br from-accent/[0.08] to-surface px-5 py-16 sm:rounded-[2.5rem] sm:px-12 sm:py-24 lg:px-20 lg:py-32">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-8%" }}
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.1 } },
            }}
            className="relative text-center"
          >
            <motion.div variants={fadeUp}>
              <Eyebrow>Become a Member</Eyebrow>
            </motion.div>

            <motion.h2
              variants={fadeUp}
              className="mx-auto mt-6 max-w-2xl font-serif text-[2rem] font-light leading-[1.12] tracking-tight text-foreground sm:mt-8 sm:text-5xl"
            >
              {closing.headline}
            </motion.h2>

            <motion.p
              variants={fadeUp}
              className="mx-auto mt-5 max-w-md text-[0.9375rem] leading-relaxed text-muted sm:mt-6 sm:text-base"
            >
              {closing.subline}
            </motion.p>

            <motion.div variants={fadeUp} className="mt-10 sm:mt-12">
              <PrimaryButton type="button" onClick={openCheckout}>
                {closing.cta}
              </PrimaryButton>
            </motion.div>

            <motion.div variants={fadeUp} className="mt-6">
              <a
                href={telHref}
                className="inline-block min-h-[44px] py-2 text-sm text-muted transition-colors active:text-accent"
              >
                Or call {closing.phone}
              </a>
            </motion.div>
          </motion.div>
        </div>
      </Section>

      <footer className="border-t border-border px-5 py-16 pb-[max(4rem,env(safe-area-inset-bottom))] text-center sm:px-10 sm:py-24 md:pb-24">
        <Reveal>
          <p className="font-serif text-xl font-light tracking-wide text-foreground sm:text-2xl">
            {brand.company}
          </p>
          <p className="mt-2 text-sm tracking-[0.16em] text-muted sm:tracking-[0.2em]">
            {brand.tagline}
          </p>

          <div className="mx-auto mt-8 max-w-sm space-y-2 sm:mt-10">
            {brand.footerLines.map((line) => (
              <p key={line} className="text-sm leading-relaxed text-muted/80">
                {line}
              </p>
            ))}
          </div>

          <div className="mt-10 sm:mt-12">
            <CraftedLine text={brand.craftedFor} />
          </div>
        </Reveal>
      </footer>
    </>
  );
}
