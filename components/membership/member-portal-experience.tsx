"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { buildWelcomeMessage } from "@/lib/membership/unlock-sequence";
import type { HomeCarePlanData } from "@/lib/home-care-plan/types";

const easeLuxury = [0.22, 1, 0.36, 1] as const;

interface MemberPortalExperienceProps {
  data: HomeCarePlanData;
  planName?: string;
}

export function MemberPortalExperience({
  data,
  planName = "Preferred Membership",
}: MemberPortalExperienceProps) {
  const planPath = `/homecare/${data.homeowner.slug}/${data.property.slug}/plan`;

  return (
    <div className="min-h-[100svh] bg-background text-foreground">
      <div className="relative min-h-[55vh] overflow-hidden">
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, ease: easeLuxury }}
        >
          <Image
            src={data.property.heroImage}
            alt={data.property.name}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-background" />
        </motion.div>

        <div className="relative flex min-h-[55vh] flex-col justify-end px-6 pb-12 pt-24 sm:px-10">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: easeLuxury, delay: 0.15 }}
            className="text-[10px] uppercase tracking-[0.32em] text-accent"
          >
            Homeowner Portal
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: easeLuxury, delay: 0.25 }}
            className="mt-3 font-serif text-4xl font-light tracking-tight sm:text-5xl md:text-6xl"
          >
            {buildWelcomeMessage(data.homeowner.firstName)}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: easeLuxury, delay: 0.4 }}
            className="mt-4 max-w-lg text-sm leading-relaxed text-white/80"
          >
            {data.property.name} · {planName} is active
          </motion.p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: easeLuxury, delay: 0.5 }}
        className="mx-auto max-w-2xl px-6 py-12 sm:px-10"
      >
        <p className="text-sm leading-relaxed text-muted">
          Your personal portal for {data.property.name}. View your Home Care
          Plan, track visits, and access membership documents as they become
          available.
        </p>

        <div className="mt-10 space-y-3">
          <Link
            href={planPath}
            className="flex min-h-[56px] items-center justify-between rounded-2xl border border-border bg-surface px-5 py-4 transition-colors hover:border-accent/30"
          >
            <span className="font-serif text-lg font-light">
              Your Home Care Plan
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-accent">
              View
            </span>
          </Link>

          <div className="flex min-h-[56px] items-center justify-between rounded-2xl border border-border/60 bg-surface/50 px-5 py-4 opacity-60">
            <span className="font-serif text-lg font-light text-muted">
              Documents & Agreements
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted">
              Coming soon
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
