"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { HomepageMediaFrame } from "@/components/marketing/homepage-media-frame";
import { craftBody, craftEyebrow, craftHeading } from "@/lib/craft/tokens";
import { materialize, riseSubtle } from "@/lib/motion/system";

function StoryReveal({
  children,
  className = "",
  delay = 0,
  variant = "materialize",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  variant?: "materialize" | "rise";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-12%" });
  const reduceMotion = useReducedMotion();
  const variants = variant === "rise" ? riseSubtle : materialize;

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduceMotion ? false : "hidden"}
      animate={reduceMotion || inView ? "visible" : "hidden"}
      variants={variants}
      transition={{ delay: reduceMotion ? 0 : delay }}
    >
      {children}
    </motion.div>
  );
}

export function HomeAtlasStorySection() {
  return (
    <section
      aria-labelledby="homeatlas-story-heading"
      className="relative bg-background py-28 sm:py-36 lg:py-44"
    >
      <div className="craft-stage-warmth pointer-events-none absolute inset-0 opacity-70" aria-hidden />

      <div className="relative mx-auto max-w-3xl px-5 sm:px-8 lg:px-10">
        <StoryReveal>
          <p className={craftEyebrow}>Meet HomeAtlas</p>
        </StoryReveal>

        <StoryReveal delay={0.08}>
          <h2
            id="homeatlas-story-heading"
            className={`${craftHeading} mt-8 text-4xl leading-[1.08] sm:mt-10 sm:text-5xl lg:text-[3.25rem]`}
          >
            Your home shouldn&apos;t have to start over every time someone
            arrives.
          </h2>
        </StoryReveal>

        <StoryReveal delay={0.2} className="mt-14 sm:mt-16 lg:mt-20">
          <div className={`${craftBody} space-y-8 text-base sm:text-lg sm:leading-[1.75]`}>
            <p>
              Most home service companies do great work.
              <br />
              Then they leave.
            </p>
            <p>
              The next visit begins from zero.
              <br />
              A different technician.
              <br />
              A different memory.
              <br />
              The same questions.
              <br />
              The same discoveries.
            </p>
            <p>
              We believe every visit should build on the last.
              <br />
              Every recommendation should be remembered.
              <br />
              Every improvement should become part of your home&apos;s story.
            </p>
            <p>
              <span className="font-serif text-xl font-light text-foreground sm:text-2xl">
                That&apos;s HomeAtlas.
              </span>
              <br />
              <span className="mt-3 block text-foreground/70">
                A living record of your home&apos;s care.
              </span>
            </p>
          </div>
        </StoryReveal>

        <StoryReveal delay={0.32} variant="rise" className="mt-20 sm:mt-28 lg:mt-32">
          <HomepageMediaFrame playWhenInView />
        </StoryReveal>
      </div>
    </section>
  );
}
