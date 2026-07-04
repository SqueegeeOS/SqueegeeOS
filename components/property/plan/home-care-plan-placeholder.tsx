"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import type { Property } from "@/lib/property/types";
import { easeLuxury } from "@/lib/property/motion";
import { AmbientGlow, Eyebrow, PageTitle, Reveal } from "../ui/primitives";

const plannedSections = [
  "Property assessment summary",
  "Home Care Score analysis",
  "Prioritized recommendations",
  "Membership options",
  "Investment overview",
  "Customer-facing presentation",
] as const;

export function HomeCarePlanPlaceholder({ property }: { property: Property }) {
  return (
    <div className="relative min-h-screen bg-background">
      <AmbientGlow />

      <div className="relative mx-auto max-w-3xl px-6 pb-24 pt-12 sm:px-10 sm:pb-32 sm:pt-16 lg:px-14">
        <Reveal>
          <Link
            href={`/properties/${property.slug}`}
            className="text-[11px] uppercase tracking-[0.3em] text-muted transition-colors hover:text-accent"
          >
            ← {property.name}
          </Link>
        </Reveal>

        <Reveal delay={0.08} className="mt-10">
          <Eyebrow>Proposal Generator</Eyebrow>
          <PageTitle className="mt-5">Create Home Care Plan</PageTitle>
          <p className="mt-6 text-base leading-relaxed text-muted sm:text-lg">
            A bespoke care proposal for{" "}
            <span className="text-foreground">{property.name}</span> — built from
            this property&apos;s timeline, score, and recommendations.
          </p>
        </Reveal>

        <Reveal delay={0.14} className="mt-12">
          <div className="rounded-3xl border border-border bg-surface p-8 sm:p-10">
            <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-accent">
              Property Context
            </p>
            <div className="mt-6 space-y-4">
              <div className="flex justify-between gap-4 border-b border-border pb-4">
                <span className="text-sm text-muted">Property</span>
                <span className="text-sm text-foreground">{property.name}</span>
              </div>
              <div className="flex justify-between gap-4 border-b border-border pb-4">
                <span className="text-sm text-muted">Home Care Score</span>
                <span className="font-serif text-lg font-light text-accent">
                  {property.homeCareScore}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-b border-border pb-4">
                <span className="text-sm text-muted">Membership</span>
                <span className="text-sm text-foreground">
                  {property.membershipStatus}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-sm text-muted">Timeline Entries</span>
                <span className="text-sm text-foreground">
                  {property.timelineLength}
                </span>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.2} className="mt-8">
          <div className="rounded-3xl border border-border bg-surface/50 p-8 sm:p-10">
            <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-muted">
              Will Include
            </p>
            <ul className="mt-6 space-y-4">
              {plannedSections.map((section) => (
                <li
                  key={section}
                  className="flex items-center gap-3 text-sm text-foreground/85"
                >
                  <span className="h-1 w-1 shrink-0 rounded-full bg-accent" />
                  {section}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal delay={0.26} className="mt-12">
          <motion.div
            whileHover={{ scale: 1.01 }}
            transition={{ duration: 0.3, ease: easeLuxury }}
            className="rounded-[2rem] border border-border bg-surface px-8 py-6 text-center"
          >
            <p className="font-serif text-xl font-light text-foreground">
              Presentation not generated yet
            </p>
            <p className="mt-3 text-sm text-muted">
              Create a Home Care Plan from the employee dashboard when this
              property is ready.
            </p>
          </motion.div>
        </Reveal>
      </div>
    </div>
  );
}
