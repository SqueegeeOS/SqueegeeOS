"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { ensureOsLaunchedDate } from "@/lib/admin/business-timeline";
import { syncHeadquartersProfile } from "@/lib/admin/headquarters-profile-client";
import type { LegacyBaseline } from "@/lib/admin/legacy-baseline";
import { buildOurStory } from "@/lib/admin/our-story";
import { computeOsTimeline } from "@/lib/admin/os-timeline";
import { isAdminUnlocked } from "@/lib/admin/pin";
import { ROUTES } from "@/lib/navigation/config";
import { loadLocalClosedJobs } from "@/lib/admin/closed-jobs-store";

const easeLuxury = [0.22, 1, 0.36, 1] as const;

export function OurStoryPage() {
  const reduceMotion = useReducedMotion();
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [legacyBaseline, setLegacyBaseline] = useState<LegacyBaseline | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    async function loadStory() {
      const pinUnlocked = isAdminUnlocked();
      setUnlocked(pinUnlocked);

      if (pinUnlocked) {
        const sync = await syncHeadquartersProfile();
        if (!cancelled) {
          setLegacyBaseline(sync.baseline);
          setReady(true);
        }
        return;
      }

      if (!cancelled) {
        setReady(true);
      }
    }

    void loadStory();

    return () => {
      cancelled = true;
    };
  }, []);

  const story = useMemo(() => {
    if (!legacyBaseline) return [];
    const closedJobs = loadLocalClosedJobs();
    const osEvents = computeOsTimeline({
      osLaunchedDate: ensureOsLaunchedDate(),
      closedJobs,
      homeCarePlansCreated: 0,
      signedAgreements: 0,
    });
    return buildOurStory({ legacyBaseline, osEvents });
  }, [legacyBaseline]);

  if (!ready) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-background text-muted">
        Opening Our Story…
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="flex min-h-[100svh] flex-col items-center justify-center gap-6 bg-background px-5 text-center">
        <p className="font-serif text-2xl font-light text-foreground">
          Our Story is for founders only.
        </p>
        <Link
          href={ROUTES.hq}
          className="rounded-full border border-accent/30 px-6 py-3 text-[10px] uppercase tracking-[0.2em] text-accent"
        >
          Enter headquarters
        </Link>
      </div>
    );
  }

  if (!legacyBaseline) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-background text-muted">
        Opening Our Story…
      </div>
    );
  }

  return (
    <div className="relative min-h-[100svh] overflow-x-hidden bg-background pb-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,184,150,0.07),transparent_55%)]" />

      <div className="relative mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
        <header className="border-b border-border/60 pb-12">
          <Link
            href={ROUTES.hq}
            className="text-[10px] uppercase tracking-[0.22em] text-muted transition-colors hover:text-accent"
          >
            ← Headquarters
          </Link>
          <p className="mt-8 text-[10px] uppercase tracking-[0.34em] text-accent">
            Our Story
          </p>
          <h1 className="mt-5 font-serif text-4xl font-light leading-[1.08] text-foreground sm:text-6xl">
            The memory of a company built with intention.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-[1.75] text-muted">
            Not for customers. For you — and everyone who will one day work
            beside you. Scroll back to where it all started.
          </p>
        </header>

        <ol className="relative mt-16 space-y-0 border-l border-border/50 pl-8 sm:pl-10">
          {story.map((milestone, index) => (
            <motion.li
              key={milestone.id}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.5,
                delay: reduceMotion ? 0 : index * 0.03,
                ease: easeLuxury,
              }}
              className="relative pb-14 last:pb-0"
            >
              <span
                className={`absolute -left-[2.15rem] top-1.5 h-3 w-3 rounded-full border sm:-left-[2.35rem] ${
                  milestone.kind === "operating_system"
                    ? "border-accent/50 bg-accent/25"
                    : milestone.kind === "future"
                      ? "border-border bg-background"
                      : "border-muted/40 bg-muted/20"
                }`}
              />
              <p
                className={`text-[10px] uppercase tracking-[0.22em] ${
                  milestone.kind === "operating_system"
                    ? "text-accent"
                    : milestone.kind === "future"
                      ? "text-muted/60"
                      : "text-muted"
                }`}
              >
                {milestone.year}
              </p>
              <h2
                className={`mt-2 font-serif text-2xl font-light sm:text-3xl ${
                  milestone.kind === "future"
                    ? "text-foreground/50"
                    : "text-foreground"
                }`}
              >
                {milestone.label}
              </h2>
              {milestone.narrative && (
                <p className="mt-3 max-w-lg text-sm leading-[1.75] text-muted">
                  {milestone.narrative}
                </p>
              )}
              {milestone.kind === "future" && (
                <p className="mt-2 text-xs italic text-muted/60">
                  Photos, videos, and journal entries will live here someday.
                </p>
              )}
            </motion.li>
          ))}
        </ol>
      </div>
    </div>
  );
}
