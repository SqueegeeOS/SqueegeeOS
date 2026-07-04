"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  buildLeadFormFromParams,
  estimatedPriceForLead,
  parseRequestSearchParams,
} from "@/lib/acquisition/request-params";
import {
  contactMethods,
  emptyLeadForm,
  preferredStartWindows,
  serviceOptions,
  type LeadIntakeFormData,
} from "@/lib/acquisition/types";
import { CUSTOMER_BRAND, CUSTOMER_CTAS } from "@/lib/brand/customer";
import {
  buildSqueegeeKingTierQuote,
  formatTierPeriodPrice,
  SQUEEGEEKING_TIER_ORDER,
  type SqueegeeKingTierId,
} from "@/lib/membership/tier-config";
import { RequestPlanTransition } from "@/components/experience/request-plan-transition";
import { AmbientGlow, Eyebrow, Reveal, easeLuxury } from "@/components/marketing/ui";

const inputClassName =
  "w-full rounded-2xl border border-border bg-surface px-4 py-3.5 text-base text-foreground placeholder:text-muted/60 focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/20";

const SQFT_MIN = 800;
const SQFT_MAX = 6000;
const SQFT_DEFAULT = 2500;

type FormPhase = "form" | "transition" | "thanks";

function ThankYouScreen({ firstName }: { firstName: string }) {
  return (
    <motion.div
      className="relative min-h-screen overflow-x-hidden bg-background px-5 py-28 sm:px-10 sm:py-32"
      style={{ paddingTop: "var(--site-chrome-offset)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.7, ease: easeLuxury }}
    >
      <AmbientGlow />
      <div className="relative mx-auto max-w-lg text-center">
        <Eyebrow>Request Received</Eyebrow>
        <h1 className="mt-8 font-serif text-4xl font-light leading-tight text-foreground sm:text-5xl">
          Thank you, {firstName}.
        </h1>
        <p className="mt-6 text-base leading-relaxed text-muted">
          Our team will reach out shortly to schedule your property inspection.
          Your personalized Home Care Plan begins there.
        </p>
        <Link
          href="/"
          className="mt-10 inline-flex min-h-[52px] items-center justify-center rounded-full border border-border px-8 text-sm tracking-[0.12em] text-foreground"
        >
          Return Home
        </Link>
      </div>
    </motion.div>
  );
}

function MembershipTierPicker({
  value,
  onChange,
}: {
  value: SqueegeeKingTierId | null;
  onChange: (tier: SqueegeeKingTierId) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {SQUEEGEEKING_TIER_ORDER.map((tierId) => {
        const tier = buildSqueegeeKingTierQuote(tierId, SQFT_DEFAULT);
        const selected = value === tierId;
        return (
          <button
            key={tierId}
            type="button"
            onClick={() => onChange(tierId)}
            className={`rounded-2xl border px-4 py-4 text-left transition-colors touch-manipulation ${
              selected
                ? "border-accent/40 bg-accent/10"
                : "border-border bg-surface"
            }`}
          >
            {tier.highlighted && (
              <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-accent">
                Recommended
              </p>
            )}
            <p className="font-medium text-foreground">{tier.label}</p>
            <p className="mt-1 text-xs text-muted">{tier.frequency}</p>
          </button>
        );
      })}
    </div>
  );
}

function RequestFormFields() {
  const searchParams = useSearchParams();
  const urlParams = useMemo(
    () => parseRequestSearchParams(searchParams),
    [searchParams],
  );
  const initialForm = useMemo(
    () => buildLeadFormFromParams(urlParams),
    [urlParams],
  );

  const [form, setForm] = useState<LeadIntakeFormData>(initialForm);
  const [phase, setPhase] = useState<FormPhase>("form");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sqftValue = form.squareFootage ?? SQFT_DEFAULT;
  const estimatedPrice = estimatedPriceForLead(
    form.membershipTier,
    form.squareFootage,
  );
  const priceLabel =
    form.membershipTier && estimatedPrice
      ? formatTierPeriodPrice(estimatedPrice, form.membershipTier)
      : null;

  const setMembershipTier = (tier: SqueegeeKingTierId) => {
    const label = buildSqueegeeKingTierQuote(tier, sqftValue).label;
    const noteLine = `Interested in ${label} membership.`;

    setForm((prev) => ({
      ...prev,
      membershipTier: tier,
      servicesInterested: prev.servicesInterested.includes(
        "Full Home Care Membership",
      )
        ? prev.servicesInterested
        : [...prev.servicesInterested, "Full Home Care Membership"],
      notes: prev.notes.includes(noteLine)
        ? prev.notes
        : prev.notes
          ? `${noteLine}\n\n${prev.notes}`
          : noteLine,
    }));
  };

  const toggleService = (service: (typeof serviceOptions)[number]) => {
    setForm((prev) => ({
      ...prev,
      servicesInterested: prev.servicesInterested.includes(service)
        ? prev.servicesInterested.filter((s) => s !== service)
        : [...prev.servicesInterested, service],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setIsSubmitting(false);
        return;
      }

      setPhase("transition");
    } catch {
      setError("Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  };

  const firstName = form.name.split(" ")[0] || "friend";

  if (phase === "thanks") {
    return <ThankYouScreen firstName={firstName} />;
  }

  return (
    <>
      <div className="relative min-h-screen overflow-x-hidden bg-background pb-24">
        <AmbientGlow />

        <div
          className="relative mx-auto max-w-xl px-5 sm:px-0"
          style={{ paddingTop: "var(--site-chrome-offset)" }}
        >
          <Reveal>
            <div className="pt-8 sm:pt-12">
              <Eyebrow>Request Your Plan</Eyebrow>
            </div>
            <h1 className="mt-6 font-serif text-[2rem] font-light leading-[1.1] tracking-tight text-foreground sm:text-4xl">
              Begin your Home Care Plan.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted">
              Tell us about your property. We&apos;ll schedule an inspection and
              craft your personalized experience.
            </p>
            {form.membershipTier && priceLabel && (
              <p className="mt-4 rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3 text-sm text-foreground">
                Your estimated{" "}
                <span className="font-medium">
                  {buildSqueegeeKingTierQuote(form.membershipTier, sqftValue).label}
                </span>{" "}
                investment:{" "}
                <span className="font-medium">{priceLabel}</span>
                {form.squareFootage
                  ? ` for ${form.squareFootage.toLocaleString()} sq ft`
                  : " (example for 2,500 sq ft — adjust below)"}
              </p>
            )}
            <p className="mt-3 text-[11px] tracking-[0.14em] text-muted/80">
              {CUSTOMER_CTAS.requestPlanHint}
            </p>
          </Reveal>

          <Reveal delay={0.1}>
            <form onSubmit={handleSubmit} className="mt-12 space-y-7 sm:mt-14">
              <div>
                <label className="mb-2 block text-[10px] uppercase tracking-[0.26em] text-muted">
                  Name
                </label>
                <input
                  required
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputClassName}
                  placeholder="Your full name"
                />
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-[10px] uppercase tracking-[0.26em] text-muted">
                    Phone
                  </label>
                  <input
                    required
                    type="tel"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                    className={inputClassName}
                    placeholder="(530) 555-0100"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[10px] uppercase tracking-[0.26em] text-muted">
                    Email
                  </label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    className={inputClassName}
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[10px] uppercase tracking-[0.26em] text-muted">
                  Service Address
                </label>
                <input
                  required
                  type="text"
                  value={form.serviceAddress}
                  onChange={(e) =>
                    setForm({ ...form, serviceAddress: e.target.value })
                  }
                  className={inputClassName}
                  placeholder="Street address, city"
                />
              </div>

              <div>
                <label className="mb-3 block text-[10px] uppercase tracking-[0.26em] text-muted">
                  Membership Interest
                </label>
                <MembershipTierPicker
                  value={form.membershipTier}
                  onChange={setMembershipTier}
                />
              </div>

              <div>
                <label
                  htmlFor="sqft-range"
                  className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.26em] text-muted"
                >
                  <span>Approximate sq ft (optional)</span>
                  <span className="normal-case tracking-normal text-foreground">
                    {sqftValue.toLocaleString()} sq ft
                  </span>
                </label>
                <input
                  id="sqft-range"
                  type="range"
                  min={SQFT_MIN}
                  max={SQFT_MAX}
                  step={100}
                  value={sqftValue}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      squareFootage: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full accent-accent"
                />
                <div className="mt-1 flex justify-between text-[10px] text-muted">
                  <span>{SQFT_MIN.toLocaleString()}</span>
                  <span>{SQFT_MAX.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="mb-3 block text-[10px] uppercase tracking-[0.26em] text-muted">
                  Services Interested In
                </label>
                <div className="flex flex-wrap gap-2">
                  {serviceOptions.map((service) => {
                    const selected = form.servicesInterested.includes(service);
                    return (
                      <button
                        key={service}
                        type="button"
                        onClick={() => toggleService(service)}
                        className={`min-h-[44px] rounded-full border px-4 py-2 text-sm transition-colors touch-manipulation ${
                          selected
                            ? "border-accent/40 bg-accent/10 text-foreground"
                            : "border-border bg-surface text-muted"
                        }`}
                      >
                        {service}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[10px] uppercase tracking-[0.26em] text-muted">
                  Preferred Start Window
                </label>
                <select
                  value={form.preferredStartWindow}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      preferredStartWindow: e.target
                        .value as LeadIntakeFormData["preferredStartWindow"],
                    })
                  }
                  className={inputClassName}
                >
                  <option value="">Select a timeframe</option>
                  {preferredStartWindows.map((window) => (
                    <option key={window} value={window}>
                      {window}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-[10px] uppercase tracking-[0.26em] text-muted">
                  Preferred Contact Method
                </label>
                <select
                  value={form.preferredContactMethod}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      preferredContactMethod: e.target
                        .value as LeadIntakeFormData["preferredContactMethod"],
                    })
                  }
                  className={inputClassName}
                >
                  {contactMethods.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-[10px] uppercase tracking-[0.26em] text-muted">
                  Notes
                </label>
                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className={`${inputClassName} resize-none`}
                  placeholder="Anything we should know about your property..."
                />
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <motion.button
                type="submit"
                disabled={isSubmitting}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.12, ease: easeLuxury }}
                className="w-full min-h-[52px] rounded-full border border-accent/40 bg-accent text-sm font-medium tracking-[0.12em] text-background touch-manipulation transition-opacity hover:opacity-95 disabled:opacity-90 sm:text-base"
              >
                {isSubmitting ? "Submitting…" : CUSTOMER_CTAS.requestPlan}
              </motion.button>
            </form>
          </Reveal>
        </div>
      </div>

      <RequestPlanTransition
        active={phase === "transition"}
        onComplete={() => setPhase("thanks")}
      />
    </>
  );
}

function RequestFormFallback() {
  return (
    <div
      className="min-h-screen bg-background"
      style={{ paddingTop: "var(--site-chrome-offset)" }}
    />
  );
}

export function RequestForm() {
  return (
    <Suspense fallback={<RequestFormFallback />}>
      <RequestFormFields />
    </Suspense>
  );
}
