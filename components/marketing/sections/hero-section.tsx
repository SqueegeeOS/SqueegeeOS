"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { CUSTOMER_CTAS } from "@/lib/brand/customer";
import { Eyebrow, easeLuxury } from "@/components/marketing/ui";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1920&q=85";

export function HeroSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative flex min-h-[100svh] flex-col overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src={HERO_IMAGE}
          alt=""
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/55 to-background" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,transparent_40%,rgba(255,255,255,0.04)_50%,transparent_60%)] opacity-60" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col justify-end px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[var(--site-nav-height)] sm:px-10 sm:pb-20 lg:px-16">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{
            duration: 1,
            ease: easeLuxury,
            delay: reduceMotion ? 0 : 0.15,
          }}
        >
          <Eyebrow>HomeAtlas · Premium Home Care</Eyebrow>
          <h1 className="mt-6 max-w-[14ch] font-serif text-[2.5rem] font-light leading-[1.04] tracking-tight text-foreground sm:max-w-3xl sm:text-6xl lg:text-7xl">
            Your home, cared for.
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-foreground/75 sm:mt-8 sm:max-w-xl sm:text-lg">
            Scroll-driven stewardship — every season handled before you have to
            think about it.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:mt-12 sm:max-w-sm">
            <Link
              href="/request"
              className="flex min-h-[52px] items-center justify-center rounded-full border border-accent/40 bg-accent px-8 text-sm font-medium tracking-[0.12em] text-background touch-manipulation transition-opacity hover:opacity-95"
            >
              {CUSTOMER_CTAS.requestPlan}
            </Link>
            <p className="text-center text-[11px] tracking-[0.14em] text-foreground/55 sm:text-left">
              {CUSTOMER_CTAS.requestPlanHint}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export { HERO_IMAGE };
