"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import type { Property } from "@/lib/property/types";
import { easeLuxury } from "@/lib/property/motion";
import {
  AIIndicator,
  HealthBadge,
  MembershipBadge,
  StatCell,
} from "../ui/badges";
import { ModuleGrid } from "./module-grid";
import { TimelinePreview } from "./timeline-preview";
import { AmbientGlow, Eyebrow, Reveal } from "../ui/primitives";

export function PropertyDashboard({ property }: { property: Property }) {
  const fullAddress = `${property.address}, ${property.city}, ${property.state} ${property.zip}`;

  return (
    <div className="relative min-h-screen bg-background">
      <AmbientGlow />

      <div className="relative">
        <div className="relative h-[52vh] min-h-[420px] overflow-hidden">
          <Image
            src={property.heroImage}
            alt={property.name}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_0%,#060606_72%)]" />
        </div>

        <div
          className="relative mx-auto max-w-7xl px-6 sm:px-10 lg:px-14"
          style={{ paddingTop: "var(--site-chrome-offset)" }}
        >
          <div className="-mt-48 sm:-mt-56">
            <Reveal delay={0.05} className="mt-8">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-border bg-surface/80 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.24em] text-muted backdrop-blur-sm">
                  {property.type}
                </span>
                <HealthBadge status={property.healthStatus} />
                <MembershipBadge status={property.membershipStatus} />
              </div>

              <h1 className="mt-6 font-serif text-5xl font-light leading-[1.02] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
                {property.name}
              </h1>
              <p className="mt-4 text-base tracking-wide text-muted sm:text-lg">
                {fullAddress}
              </p>
            </Reveal>

            <Reveal delay={0.15} className="mt-10 max-w-3xl">
              <p className="text-base leading-relaxed text-foreground/75 sm:text-lg sm:leading-relaxed">
                {property.narrative}
              </p>
            </Reveal>

            <Reveal delay={0.2} className="mt-12">
              <div className="grid gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
                <div className="bg-surface p-7 sm:p-8">
                  <div className="flex items-baseline gap-2">
                    <span className="font-serif text-6xl font-light tracking-tight text-accent">
                      {property.homeCareScore}
                    </span>
                    <span className="text-[11px] uppercase tracking-[0.28em] text-muted">
                      / 100
                    </span>
                  </div>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.26em] text-muted">
                    Home Care Score
                  </p>
                </div>
                <div className="bg-surface p-7 sm:p-8">
                  <StatCell label="Last Visit" value={property.lastVisit} />
                </div>
                <div className="bg-surface p-7 sm:p-8">
                  <StatCell
                    label="Next Scheduled"
                    value={property.nextScheduledVisit ?? "Not scheduled"}
                  />
                </div>
                <div className="bg-surface p-7 sm:p-8">
                  <AIIndicator status={property.aiStatus} />
                  <p className="mt-4 text-[10px] uppercase tracking-[0.26em] text-muted">
                    Intelligence
                  </p>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.25} className="mt-8">
              <div className="flex flex-wrap gap-8 rounded-2xl border border-border bg-surface/50 px-7 py-6 sm:px-8">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.26em] text-muted">
                    Built
                  </p>
                  <p className="mt-1 font-serif text-xl font-light text-foreground">
                    {property.yearBuilt}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.26em] text-muted">
                    Square Feet
                  </p>
                  <p className="mt-1 font-serif text-xl font-light text-foreground">
                    {property.squareFeet.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.26em] text-muted">
                    Photos Archived
                  </p>
                  <p className="mt-1 font-serif text-xl font-light text-foreground">
                    {property.photoCount.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.26em] text-muted">
                    Timeline Depth
                  </p>
                  <p className="mt-1 font-serif text-xl font-light text-foreground">
                    {property.timelineLength} visits
                  </p>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.28} className="mt-10">
              <Link href={`/properties/${property.slug}/home-care-plan`}>
                <motion.div
                  whileHover={{ scale: 1.01, y: -2 }}
                  whileTap={{ scale: 0.99 }}
                  transition={{ duration: 0.35, ease: easeLuxury }}
                  className="group relative overflow-hidden rounded-[2rem] border border-accent/30 bg-accent px-8 py-5 text-center sm:inline-block sm:px-12 sm:py-6"
                >
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <span className="relative text-sm font-medium tracking-[0.14em] text-background sm:text-base">
                    Create Home Care Plan
                  </span>
                </motion.div>
              </Link>
            </Reveal>
          </div>

          <div className="mt-24 space-y-24 pb-24 sm:mt-32 sm:space-y-32 sm:pb-32">
            <section>
              <TimelinePreview
                entries={property.recentTimeline}
                totalLength={property.timelineLength}
              />
            </section>

            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

            <section>
              <ModuleGrid
                timelineLength={property.timelineLength}
                photoCount={property.photoCount}
              />
            </section>

            <Reveal>
              <div className="rounded-[2rem] border border-accent/20 bg-gradient-to-br from-accent/[0.08] to-surface px-8 py-12 text-center sm:px-16 sm:py-16">
                <Eyebrow>Property Archive</Eyebrow>
                <p className="mx-auto mt-6 max-w-2xl font-serif text-3xl font-light leading-snug tracking-tight text-foreground sm:text-4xl">
                  {property.timelineLength} visits. {property.photoCount.toLocaleString()}{" "}
                  photographs. One continuous story.
                </p>
                <p className="mx-auto mt-5 max-w-lg text-sm leading-relaxed text-muted">
                  This is the foundation every future feature will connect to —
                  the documented life of {property.name}.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </div>
  );
}
