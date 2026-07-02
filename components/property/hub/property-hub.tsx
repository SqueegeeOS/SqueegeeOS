"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { homeowner } from "@/lib/property/mock-data";
import { stagger } from "@/lib/property/motion";
import { PropertyCard } from "./property-card";
import {
  AmbientGlow,
  Eyebrow,
  PageLead,
  PageTitle,
  Reveal,
} from "../ui/primitives";

export function PropertyHub() {
  const propertyCount = homeowner.properties.length;
  const totalPhotos = homeowner.properties.reduce((sum, p) => sum + p.photoCount, 0);
  const totalTimeline = homeowner.properties.reduce(
    (sum, p) => sum + p.timelineLength,
    0,
  );

  return (
    <div className="relative min-h-screen bg-background">
      <AmbientGlow />

      <div className="relative mx-auto max-w-7xl px-6 pb-24 pt-12 sm:px-10 sm:pb-32 sm:pt-16 lg:px-14">
        <Reveal>
          <div className="flex flex-col gap-6 border-b border-border pb-12 sm:pb-16 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Eyebrow>Property Hub</Eyebrow>
              <PageTitle className="mt-5">
                {homeowner.fullName}
              </PageTitle>
              <PageLead className="mt-6">
                Four properties. Four living archives. Each home carries its own
                score, timeline, and story — independent, documented, and cared
                for over time.
              </PageLead>
            </div>

            <div className="flex gap-8 lg:gap-12">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-muted">
                  Properties
                </p>
                <p className="mt-2 font-serif text-3xl font-light text-foreground">
                  {propertyCount}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-muted">
                  Archive
                </p>
                <p className="mt-2 font-serif text-3xl font-light text-foreground">
                  {totalPhotos.toLocaleString()}
                  <span className="ml-1 text-lg text-muted">photos</span>
                </p>
              </div>
              <div className="hidden sm:block">
                <p className="text-[10px] uppercase tracking-[0.3em] text-muted">
                  Timeline
                </p>
                <p className="mt-2 font-serif text-3xl font-light text-foreground">
                  {totalTimeline}
                  <span className="ml-1 text-lg text-muted">entries</span>
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1} className="mt-10 sm:mt-12">
          <p className="max-w-3xl text-sm leading-relaxed text-muted/90">
            You are not opening a customer record. You are entering each
            property&apos;s digital memory — every visit, photograph, and
            recommendation preserved in sequence.
          </p>
        </Reveal>

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="mt-14 grid gap-8 lg:mt-16 lg:grid-cols-2 lg:gap-10"
        >
          {homeowner.properties.map((property) => (
            <PropertyCard key={property.slug} property={property} />
          ))}
        </motion.div>

        <Reveal delay={0.2} className="mt-16 text-center sm:mt-20">
          <p className="font-serif text-sm font-light tracking-[0.25em] text-muted/50">
            SqueegeeOS Property Hub
          </p>
          <Link
            href="/employee"
            className="mt-4 inline-block text-[11px] uppercase tracking-[0.3em] text-muted transition-colors hover:text-accent"
          >
            ← Employee Dashboard
          </Link>
        </Reveal>
      </div>
    </div>
  );
}
