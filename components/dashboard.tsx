"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { SQUEEGEEKING_FOUNDERS } from "@/lib/team/founders";

const ease = [0.22, 1, 0.36, 1] as const;

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.15,
    },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease },
  },
};

const cards = [
  {
    label: "Today's Members",
    value: "12",
    detail: "Active homeowners today",
  },
  {
    label: "Today's Revenue",
    value: "$4,280",
    detail: "Collected across visits",
  },
  {
    label: "Upcoming Visits",
    value: "8",
    detail: "Scheduled for the week",
  },
  {
    label: "Pending Home Care Plans",
    value: "3",
    detail: "Awaiting your signature",
  },
] as const;

function DashboardCard({
  label,
  value,
  detail,
  index,
}: {
  label: string;
  value: string;
  detail: string;
  index: number;
}) {
  return (
    <motion.article
      variants={fadeUp}
      whileHover={{
        y: -4,
        transition: { duration: 0.35, ease },
      }}
      className="group relative overflow-hidden rounded-3xl border border-border bg-surface p-8 sm:p-10"
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/5 blur-2xl transition-opacity duration-500 group-hover:opacity-100 opacity-60" />
      <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-muted">
        {label}
      </p>
      <p className="mt-6 font-serif text-5xl font-light tracking-tight text-foreground sm:text-6xl">
        {value}
      </p>
      <p className="mt-4 max-w-[18rem] text-sm leading-relaxed text-muted">
        {detail}
      </p>
      <div className="mt-8 h-px w-full bg-gradient-to-r from-accent/30 via-border to-transparent" />
      <p className="mt-4 text-[11px] uppercase tracking-[0.22em] text-muted/70">
        {String(index + 1).padStart(2, "0")}
      </p>
    </motion.article>
  );
}

export function Dashboard() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-20%] h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-accent/[0.07] blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[400px] w-[400px] rounded-full bg-white/[0.02] blur-[100px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,184,150,0.06),transparent_55%)]" />
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative mx-auto flex min-h-screen max-w-6xl flex-col overflow-x-hidden px-5 pb-20 sm:px-10 sm:pb-24 lg:px-12"
        style={{ paddingTop: "calc(var(--site-chrome-offset) + 1.5rem)" }}
      >
        <main className="flex flex-1 flex-col">
          <motion.section variants={fadeUp} className="mb-14 sm:mb-16 lg:mb-20">
            <p className="mb-5 text-[11px] font-medium uppercase tracking-[0.35em] text-accent">
              Thursday, July 2
            </p>
            <h1 className="max-w-3xl font-serif text-5xl font-light leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Good Morning, Noah.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted sm:mt-8 sm:text-xl sm:leading-relaxed">
              Today you&apos;re helping homeowners protect their greatest
              investment.
            </p>
          </motion.section>

          <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:gap-7">
            {cards.map((card, index) => (
              <DashboardCard key={card.label} {...card} index={index} />
            ))}
          </section>

          <motion.section
            variants={fadeUp}
            className="mt-14 flex flex-col gap-5 sm:mt-16 sm:max-w-xl sm:gap-6 lg:mt-20"
          >
            <Link href="/employee/home-care-plan/create" className="block">
            <motion.div whileHover={{ scale: 1.01, y: -2 }} whileTap={{ scale: 0.99 }}>
              <div
                className="group relative w-full overflow-hidden rounded-[2rem] border border-accent/30 bg-accent px-8 py-6 text-center sm:px-10 sm:py-7"
              >
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <span className="relative block font-sans text-base font-medium tracking-[0.12em] text-background sm:text-lg">
                  New Home Care Plan
                </span>
              </div>
            </motion.div>
            </Link>

            <Link href="/presentations" className="block">
              <motion.div
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.99 }}
                transition={{ duration: 0.35, ease }}
                className="group relative overflow-hidden rounded-[2rem] border border-border bg-surface px-8 py-6 sm:px-10 sm:py-7"
              >
                <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-accent">
                  Presentations
                </p>
                <p className="relative mt-3 font-serif text-2xl font-light tracking-tight text-foreground">
                  Live Signature Close
                </p>
                <p className="relative mt-2 text-sm text-muted">
                  Build a deck, present full-screen, sign on the close slide
                </p>
              </motion.div>
            </Link>

            <Link href="/properties" className="block">
              <motion.div
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.99 }}
                transition={{ duration: 0.35, ease }}
                className="group relative overflow-hidden rounded-[2rem] border border-border bg-surface px-8 py-6 sm:px-10 sm:py-7"
              >
                <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-accent/5 blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-accent">
                  Property Hub
                </p>
                <p className="relative mt-3 font-serif text-2xl font-light tracking-tight text-foreground">
                  Open Property Hub
                </p>
                <p className="relative mt-2 text-sm text-muted">
                  Browse properties, timelines, and living archives
                </p>
              </motion.div>
            </Link>
          </motion.section>

          <motion.p
            variants={fadeUp}
            className="mt-16 text-center text-[10px] uppercase tracking-[0.24em] text-muted/70"
          >
            Founder-led · {SQUEEGEEKING_FOUNDERS.map((f) => f.name).join(" & ")}
          </motion.p>
        </main>
      </motion.div>
    </div>
  );
}
