"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { larryBuckley } from "../data";
import { easeLuxury, fadeIn, fadeUp } from "../motion";

export function Hero() {
  const { hero } = larryBuckley;

  return (
    <section className="relative flex min-h-[100dvh] flex-col justify-end overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1920&q=85"
          alt=""
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-[#060606]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#060606_75%)]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-16 pt-32 sm:px-10 sm:pb-24 lg:px-16 lg:pb-32">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.12, delayChildren: 0.3 } },
          }}
        >
          <motion.p
            variants={fadeUp}
            className="mb-8 text-[11px] font-medium uppercase tracking-[0.42em] text-accent"
          >
            {hero.eyebrow}
          </motion.p>

          <motion.h1
            variants={fadeUp}
            className="max-w-4xl font-serif text-5xl font-light leading-[1.02] tracking-tight text-foreground sm:text-6xl md:text-7xl lg:text-[5.5rem] lg:leading-[1.02]"
          >
            {hero.headline}
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mt-8 max-w-xl text-lg leading-relaxed text-foreground/75 sm:mt-10 sm:text-xl sm:leading-relaxed"
          >
            {hero.subline}
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="mt-12 flex flex-col gap-1 sm:mt-16"
          >
            <p className="font-serif text-2xl font-light tracking-tight text-foreground sm:text-3xl">
              {hero.address}
            </p>
            <p className="text-sm tracking-[0.2em] text-muted uppercase">
              {hero.city}
            </p>
          </motion.div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 1.2, ease: easeLuxury }}
        className="relative z-10 flex justify-center pb-10"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="flex flex-col items-center gap-3"
        >
          <span className="text-[10px] uppercase tracking-[0.35em] text-muted">
            Scroll
          </span>
          <div className="h-12 w-px bg-gradient-to-b from-accent/60 to-transparent" />
        </motion.div>
      </motion.div>
    </section>
  );
}
