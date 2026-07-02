"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import type { HomeCarePlanData } from "@/lib/home-care-plan/canyon-oaks";
import { easePlan, fadeUp } from "../ui/primitives";
import { PrimaryButton } from "../ui/primary-button";

export function PlanHero({ data }: { data: HomeCarePlanData }) {
  const reduceMotion = useReducedMotion();

  const scrollToSnapshot = () => {
    document.getElementById("snapshot")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src={data.property.heroImage}
          alt=""
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/55 to-[#060606]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#060606_72%)]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-[max(5rem,env(safe-area-inset-bottom))] pt-[max(6rem,env(safe-area-inset-top))] sm:px-10 sm:pb-28 lg:px-16 lg:pb-36">
        <motion.div
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
          variants={{
            hidden: {},
            visible: {
              transition: {
                staggerChildren: reduceMotion ? 0 : 0.12,
                delayChildren: reduceMotion ? 0 : 0.35,
              },
            },
          }}
        >
          <motion.div variants={fadeUp}>
            <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-foreground/50 sm:tracking-[0.42em]">
              {data.brand.company}
            </p>
          </motion.div>

          <motion.p
            variants={fadeUp}
            className="mt-10 font-serif text-sm italic tracking-wide text-accent/90 sm:mt-16"
          >
            {data.brand.craftedFor}
          </motion.p>

          <motion.h1
            variants={fadeUp}
            className="mt-5 max-w-[14ch] font-serif text-[2.375rem] font-light leading-[1.04] tracking-tight text-foreground sm:mt-6 sm:max-w-4xl sm:text-6xl md:text-7xl"
          >
            {data.hero.title}
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mt-6 max-w-xl font-serif text-lg font-light leading-snug text-foreground/90 sm:mt-8 sm:text-2xl sm:leading-relaxed"
          >
            {data.hero.subheadline}
          </motion.p>

          <motion.p
            variants={fadeUp}
            className="mt-6 max-w-lg text-[0.9375rem] leading-relaxed text-foreground/65 sm:mt-8 sm:max-w-xl sm:text-lg sm:leading-relaxed"
          >
            {data.hero.intro}
          </motion.p>

          <motion.div variants={fadeUp} className="mt-10 sm:mt-12">
            <PrimaryButton type="button" onClick={scrollToSnapshot}>
              {data.hero.cta}
            </PrimaryButton>
          </motion.div>
        </motion.div>
      </div>

      {!reduceMotion && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 1.2, ease: easePlan }}
          className="relative z-10 hidden justify-center pb-8 sm:flex"
        >
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            className="h-12 w-px bg-gradient-to-b from-accent/50 to-transparent"
          />
        </motion.div>
      )}
    </section>
  );
}
