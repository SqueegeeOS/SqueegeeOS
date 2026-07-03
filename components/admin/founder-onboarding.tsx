"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";
import type { LegacyBaseline } from "@/lib/admin/legacy-baseline";
import {
  DEFAULT_FOUNDERS,
  EMPTY_LEGACY_BASELINE,
  buildDefaultLegacyMilestones,
} from "@/lib/admin/legacy-baseline";
import {
  persistHeadquartersProfile,
  type HeadquartersSyncResult,
} from "@/lib/admin/headquarters-profile-client";
import { ensureOsLaunchedDate } from "@/lib/admin/business-timeline";
import { buildLegacyStory } from "@/lib/admin/legacy-story";

const easeLuxury = [0.22, 1, 0.36, 1] as const;

const inputClassName =
  "w-full rounded-2xl border border-border bg-background px-4 py-3.5 text-base text-foreground placeholder:text-muted/50 focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/20";

const labelClassName =
  "mb-2 block text-[10px] uppercase tracking-[0.24em] text-muted";

type PreserveStep = "welcome" | "facts" | "founders" | "ceremony";

interface FounderOnboardingProps {
  onComplete: (
    baseline: LegacyBaseline,
    sync?: HeadquartersSyncResult,
  ) => void;
}

export function FounderOnboarding({ onComplete }: FounderOnboardingProps) {
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState<PreserveStep>("welcome");
  const [form, setForm] = useState<LegacyBaseline>(EMPTY_LEGACY_BASELINE);
  const [saving, setSaving] = useState(false);

  const ceremonyStory = useMemo(() => {
    const draft = {
      ...form,
      configured: true,
      founders: form.founders ?? DEFAULT_FOUNDERS,
    };
    return buildLegacyStory(draft);
  }, [form]);

  const handleComplete = async () => {
    if (saving) return;
    setSaving(true);
    ensureOsLaunchedDate();
    const draft: LegacyBaseline = {
      ...form,
      configured: true,
      onboardingComplete: true,
      founders: form.founders ?? DEFAULT_FOUNDERS,
      fiveStarReviews: form.googleReviews,
      homesProtected: form.homesServed,
      activeMembers: form.recurringCustomers,
    };
    const saved: LegacyBaseline = {
      ...draft,
      legacyMilestones: buildDefaultLegacyMilestones(draft),
    };
    const sync = await persistHeadquartersProfile(saved);
    onComplete(sync.baseline, sync);
    setSaving(false);
  };

  if (step === "welcome") {
    return (
      <div className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-background px-5 py-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,184,150,0.08),transparent_58%)]" />
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: easeLuxury }}
          className="relative max-w-2xl text-center"
        >
          <p className="text-[10px] uppercase tracking-[0.34em] text-accent">
            SqueegeeKing Headquarters
          </p>
          <h1 className="mt-8 font-serif text-4xl font-light leading-[1.1] text-foreground sm:text-6xl">
            Preserving the Legacy
          </h1>
          <p className="mx-auto mt-8 max-w-xl text-base leading-[1.85] text-muted sm:text-lg">
            Every great company has a story before it has software.
            <br />
            <br />
            Today we&apos;re preserving the history you&apos;ve already built so
            the next chapter can begin.
          </p>
          <button
            type="button"
            onClick={() => setStep("facts")}
            className="mt-12 rounded-full border border-accent/30 bg-accent/[0.08] px-8 py-4 text-[10px] uppercase tracking-[0.24em] text-accent transition-colors hover:bg-accent/[0.12]"
          >
            Begin the archive
          </button>
        </motion.div>
      </div>
    );
  }

  if (step === "facts") {
    return (
      <div className="relative min-h-[100svh] bg-background px-5 py-14 sm:px-8">
        <div className="mx-auto max-w-2xl">
          <p className="text-[10px] uppercase tracking-[0.28em] text-accent">
            Preserving the Legacy
          </p>
          <h2 className="mt-4 font-serif text-3xl font-light text-foreground sm:text-4xl">
            Record what you&apos;ve already built.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            This should feel like archiving history — permanent, honored, never
            auto-generated.
          </p>

          <div className="mt-10 space-y-5">
            <div>
              <label className={labelClassName}>When was SqueegeeKing founded?</label>
              <input
                type="date"
                className={inputClassName}
                value={form.companyFoundedDate ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    companyFoundedDate: e.target.value || null,
                  }))
                }
              />
            </div>
            {[
              { key: "googleReviews", label: "How many Google reviews do you currently have?", type: "number" },
              { key: "homesServed", label: "How many homes have you served?", type: "number" },
              { key: "lifetimeRevenue", label: "Approximate lifetime revenue before this platform?", type: "number" },
              { key: "largestMonth", label: "Largest month ever?", type: "text" },
              { key: "largestJob", label: "Largest completed job?", type: "text" },
              { key: "recurringCustomers", label: "Current recurring customers?", type: "number" },
            ].map((field) => (
              <div key={field.key}>
                <label className={labelClassName}>{field.label}</label>
                <input
                  type={field.type}
                  className={inputClassName}
                  value={
                    field.type === "number"
                      ? (form[field.key as keyof LegacyBaseline] as number) || ""
                      : (form[field.key as keyof LegacyBaseline] as string)
                  }
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      [field.key]:
                        field.type === "number"
                          ? Number(e.target.value) || 0
                          : e.target.value,
                    }))
                  }
                />
              </div>
            ))}
          </div>

          <div className="mt-10 flex gap-3">
            <button
              type="button"
              onClick={() => setStep("founders")}
              className="rounded-full border border-accent/30 bg-accent/[0.08] px-6 py-3 text-[10px] uppercase tracking-[0.2em] text-accent"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "founders") {
    return (
      <div className="relative min-h-[100svh] bg-background px-5 py-14 sm:px-8">
        <div className="mx-auto max-w-2xl">
          <p className="text-[10px] uppercase tracking-[0.28em] text-accent">
            Preserving the Legacy
          </p>
          <h2 className="mt-4 font-serif text-3xl font-light text-foreground sm:text-4xl">
            The people behind the company.
          </h2>

          <div className="mt-10 space-y-5">
            {[
              { key: "aboutNoah", label: "Tell us about Noah." },
              { key: "aboutDasan", label: "Tell us about Dasan." },
              { key: "companyStandFor", label: "What does SqueegeeKing stand for?" },
            ].map((field) => (
              <div key={field.key}>
                <label className={labelClassName}>{field.label}</label>
                <textarea
                  rows={4}
                  className={inputClassName}
                  value={form[field.key as keyof LegacyBaseline] as string}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>

          <div className="mt-10">
            <button
              type="button"
              onClick={() => setStep("ceremony")}
              className="rounded-full border border-accent/30 bg-accent/[0.08] px-6 py-3 text-[10px] uppercase tracking-[0.2em] text-accent"
            >
              Seal the archive
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-background px-5 py-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(201,184,150,0.06),transparent_65%)]" />
      <motion.div
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, ease: easeLuxury }}
        className="relative max-w-2xl text-center"
      >
        <p className="text-[10px] uppercase tracking-[0.32em] text-accent">
          Archive Sealed
        </p>
        <h2 className="mt-6 font-serif text-3xl font-light text-foreground sm:text-5xl">
          The Legacy is preserved.
        </h2>
        <p className="mx-auto mt-6 max-w-lg text-sm leading-relaxed text-muted">
          You&apos;ve already built something worth protecting. From this moment
          forward, the Operating System records where you&apos;re going.
        </p>

        <div className="mx-auto mt-12 max-w-md space-y-4 text-left">
          {ceremonyStory.chapters.slice(0, 6).map((chapter, index) => (
            <motion.div
              key={chapter.id}
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: 0.6,
                delay: reduceMotion ? 0 : 0.12 * index,
                ease: easeLuxury,
              }}
              className="border-b border-border/40 pb-4"
            >
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted">
                {chapter.label}
              </p>
              <p className="mt-2 font-serif text-2xl font-light text-foreground">
                {chapter.value}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.button
          type="button"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduceMotion ? 0 : 0.8, duration: 0.7, ease: easeLuxury }}
          onClick={() => void handleComplete()}
          disabled={saving}
          className="mt-14 rounded-full border border-accent/30 bg-accent/[0.1] px-8 py-4 text-[10px] uppercase tracking-[0.24em] text-accent disabled:opacity-50"
        >
          {saving ? "Saving to cloud…" : "Enter headquarters"}
        </motion.button>
      </motion.div>
    </div>
  );
}
