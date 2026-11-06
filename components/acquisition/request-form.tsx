"use client";

import { Suspense, useMemo, useRef, useState } from "react";
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
  preferredStartWindows,
  serviceOptions,
  type LeadIntakeFormData,
} from "@/lib/acquisition/types";
import { CUSTOMER_CONTACT, CUSTOMER_CTAS } from "@/lib/brand/customer";
import { createLeadSubmissionId } from "@/lib/acquisition/lead-submission-id";
import {
  buildSqueegeeKingTierQuote,
  formatTierPeriodPrice,
  SQUEEGEEKING_TIER_ORDER,
  type SqueegeeKingTierId,
} from "@/lib/membership/tier-config";
import { RequestPlanTransition } from "@/components/experience/request-plan-transition";
import { AmbientGlow, Eyebrow, Reveal, easeLuxury } from "@/components/marketing/ui";

const inputClassName =
  "w-full rounded-2xl border border-border bg-surface px-4 py-3.5 text-base text-foreground placeholder:text-muted focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20";

const SQFT_MIN = 800;
const SQFT_MAX = 6000;
const SQFT_DEFAULT = 2500;

type FormPhase = "form" | "transition" | "thanks";

function ThankYouScreen({ firstName }: { firstName: string }) {
  return (
    <motion.div
      className="customer-theme relative min-h-screen overflow-x-hidden bg-background px-5 py-28 sm:px-10 sm:py-32"
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
          className="customer-button-secondary mt-10 inline-flex min-h-[52px] items-center justify-center rounded-full px-8 text-sm font-medium"
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
            aria-pressed={selected}
            className={`rounded-2xl border px-4 py-4 text-left transition-colors touch-manipulation ${
              selected
                ? "border-accent/40 bg-accent/10"
                : "border-border bg-surface"
            }`}
          >
            {tier.highlighted && (
              <p className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-accent">
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
  const submitInFlightRef = useRef(false);
  const submissionAttemptRef = useRef<{
    id: string;
    payload: string;
  } | null>(null);

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
    if (submitInFlightRef.current) return;

    submitInFlightRef.current = true;

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = JSON.stringify(form);
      const submissionAttempt =
        submissionAttemptRef.current?.payload === payload
          ? submissionAttemptRef.current
          : { id: createLeadSubmissionId(), payload };
      submissionAttemptRef.current = submissionAttempt;

      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          submissionId: submissionAttempt.id,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        submitInFlightRef.current = false;
        setIsSubmitting(false);
        return;
      }

      submissionAttemptRef.current = null;
      setPhase("transition");
    } catch {
      setError("Something went wrong. Please try again.");
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const firstName = form.name.split(" ")[0] || "friend";

  if (phase === "thanks") {
    return <ThankYouScreen firstName={firstName} />;
  }

  return (
    <>
      <main className="relative min-h-screen customer-theme overflow-x-hidden bg-background pb-24">
        <AmbientGlow />

        <div
          className="relative mx-auto max-w-xl px-5 sm:px-0"
          style={{ paddingTop: "var(--site-chrome-offset)" }}
        >
          <Reveal>
            <div className="pt-8 sm:pt-12">
              <Eyebrow>One-time or recurring care</Eyebrow>
            </div>
            <h1 className="mt-6 font-serif text-[2rem] font-light leading-[1.1] tracking-tight text-foreground sm:text-4xl">
              Request a free quote.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted">
              Tell us what your home needs. Start with a one-time cleaning or
              explore recurring care. We&apos;ll confirm the scope and next steps
              with you before you decide.
            </p>
            {form.membershipTier && priceLabel && (
              <div className="mt-4 rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3 text-sm text-foreground">
                <p>
                  Your estimated{" "}
                  <span className="font-medium">
                    {buildSqueegeeKingTierQuote(form.membershipTier, sqftValue).label}
                  </span>:{" "}
                  <span className="font-medium">{priceLabel}</span>
                  {form.squareFootage
                    ? ` for ${form.squareFootage.toLocaleString()} sq ft`
                    : " (example for 2,500 sq ft — adjust below)"}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                  Exterior glass only. Screens, interior cleaning, cobweb
                  removal, and specialty work are priced separately in your
                  personalized plan.
                </p>
              </div>
            )}
            <p className="mt-3 text-sm text-muted">
              {CUSTOMER_CTAS.requestPlanHint}
            </p>
            <ol
              className="mt-8 grid grid-cols-3 overflow-hidden rounded-[1.4rem] border border-border bg-surface"
              aria-label="What happens after you request a plan"
            >
              {[
                ["01", "Tell us"],
                ["02", "We review"],
                ["03", "We reach out"],
              ].map(([number, label], index) => (
                <li
                  key={number}
                  className={`relative px-3 py-4 text-center ${index > 0 ? "border-l border-border/70" : ""}`}
                >
                  <span className="block font-mono text-xs tracking-[0.12em] text-accent">
                    {number}
                  </span>
                  <span className="mt-1.5 block text-xs font-medium text-foreground">
                    {label}
                  </span>
                </li>
              ))}
            </ol>
          </Reveal>

          <Reveal delay={0.1}>
            <form onSubmit={handleSubmit} className="customer-panel mt-8 space-y-7 rounded-3xl p-5 sm:mt-10 sm:p-8">
              <div>
                <label
                  htmlFor="request-name"
                  className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-muted"
                >
                  Name
                </label>
                <input
                  id="request-name"
                  required
                  type="text"
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputClassName}
                  placeholder="Your full name"
                />
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="request-phone"
                    className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-muted"
                  >
                    Phone
                  </label>
                  <input
                    id="request-phone"
                    required
                    type="tel"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                    className={inputClassName}
                    placeholder="(530) 555-0100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="request-email"
                    className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-muted"
                  >
                    Email
                  </label>
                  <input
                    id="request-email"
                    required
                    type="email"
                    autoComplete="email"
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
                <label
                  htmlFor="request-address"
                  className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-muted"
                >
                  Service Address
                </label>
                <input
                  id="request-address"
                  required
                  type="text"
                  autoComplete="street-address"
                  value={form.serviceAddress}
                  onChange={(e) =>
                    setForm({ ...form, serviceAddress: e.target.value })
                  }
                  className={inputClassName}
                  placeholder="Street address, city"
                />
              </div>

              <fieldset>
                <legend className="mb-3 block text-xs font-medium uppercase tracking-[0.12em] text-muted">
                  Membership interest (optional)
                </legend>
                <p className="mb-4 text-sm leading-relaxed text-muted">
                  Just need one visit, or not sure yet? Leave this blank and tell
                  us which services you need below.
                </p>
                <MembershipTierPicker
                  value={form.membershipTier}
                  onChange={setMembershipTier}
                />
              </fieldset>

              <div>
                <label
                  htmlFor="sqft-range"
                  className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-medium uppercase tracking-[0.12em] text-muted"
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
                  className="min-h-11 w-full accent-accent"
                />
                <div className="mt-1 flex justify-between text-xs text-muted">
                  <span>{SQFT_MIN.toLocaleString()}</span>
                  <span>{SQFT_MAX.toLocaleString()}</span>
                </div>
              </div>

              <fieldset>
                <legend className="mb-3 block text-xs font-medium uppercase tracking-[0.12em] text-muted">
                  Services Interested In
                </legend>
                <div className="flex flex-wrap gap-2">
                  {serviceOptions.map((service) => {
                    const selected = form.servicesInterested.includes(service);
                    return (
                      <button
                        key={service}
                        type="button"
                        onClick={() => toggleService(service)}
                        aria-pressed={selected}
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
              </fieldset>

              <div>
                <label
                  htmlFor="request-start-window"
                  className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-muted"
                >
                  Preferred Start Window
                </label>
                <select
                  id="request-start-window"
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
                <label
                  htmlFor="request-contact-method"
                  className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-muted"
                >
                  Preferred Contact Method
                </label>
                <select
                  id="request-contact-method"
                  value={form.preferredContactMethod}
                  onChange={(e) => {
                    const preferredContactMethod = e.target
                      .value as LeadIntakeFormData["preferredContactMethod"];
                    setForm({
                      ...form,
                      preferredContactMethod,
                      smsConsent:
                        preferredContactMethod === "Text"
                          ? form.smsConsent
                          : false,
                    });
                  }}
                  className={inputClassName}
                >
                  {contactMethods.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>

                {form.preferredContactMethod === "Text" ? (
                  <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-2xl border border-accent/15 bg-accent/[0.035] p-4 text-left">
                    <input
                      type="checkbox"
                      checked={form.smsConsent}
                      onChange={(event) =>
                        setForm({ ...form, smsConsent: event.target.checked })
                      }
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                      required
                    />
                    <span className="text-sm leading-relaxed text-muted">
                      I agree to receive transactional texts from SqueegeeKing
                      about this request, appointments, and service updates.
                      Message frequency varies. Message and data rates may
                      apply. Reply STOP to opt out or HELP for help. You can
                      also call{" "}
                      <a
                        href={CUSTOMER_CONTACT.phoneHref}
                        className="text-foreground underline underline-offset-2"
                      >
                        {CUSTOMER_CONTACT.phoneDisplay}
                      </a>
                      . Consent is not a condition of purchase. See our{" "}
                      <Link
                        href="/privacy"
                        className="text-foreground underline underline-offset-2"
                      >
                        Privacy Policy
                      </Link>{" "}
                      and{" "}
                      <Link
                        href="/terms"
                        className="text-foreground underline underline-offset-2"
                      >
                        Terms
                      </Link>
                      .
                    </span>
                  </label>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="request-notes"
                  className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-muted"
                >
                  Notes
                </label>
                <textarea
                  id="request-notes"
                  rows={4}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className={`${inputClassName} resize-none`}
                  placeholder="Anything we should know about your property..."
                />
              </div>

              {error && (
                <p className="text-sm text-[#a03535]" role="alert">
                  {error}
                </p>
              )}

              <motion.button
                type="submit"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.12, ease: easeLuxury }}
                className="customer-button-primary w-full min-h-[52px] rounded-full text-base font-medium touch-manipulation transition-opacity hover:opacity-95 disabled:opacity-70"
              >
                {isSubmitting ? "Submitting…" : "Request my free quote"}
              </motion.button>
              <p className="text-center text-sm leading-relaxed text-muted">
                No spam and no obligation. Your property details stay with
                SqueegeeKing.
              </p>
            </form>
          </Reveal>
        </div>
      </main>

      <RequestPlanTransition
        appearance="customer"
        active={phase === "transition"}
        onComplete={() => setPhase("thanks")}
      />
    </>
  );
}

function RequestFormFallback() {
  return (
    <main
      className="customer-theme min-h-screen bg-background px-5 pb-24"
      style={{ paddingTop: "var(--site-chrome-offset)" }}
    >
      <div className="mx-auto max-w-xl pt-8 sm:pt-12">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">
          SqueegeeKing · Chico, California
        </p>
        <h1 className="mt-6 font-serif text-[2rem] font-light leading-[1.1] text-foreground sm:text-4xl">
          Request a free quote.
        </h1>
        <p className="mt-5 text-base leading-relaxed text-muted">
          Request a free quote for window cleaning, gutter cleaning, pressure
          washing, or solar panel cleaning. One-time and recurring care are
          available for Chico homes.
        </p>
        <p role="status" className="mt-6 text-sm text-muted">
          Loading the request form. You can also call us directly:
        </p>
        <a
          href={CUSTOMER_CONTACT.phoneHref}
          className="customer-button-secondary mt-4 inline-flex min-h-12 items-center rounded-full px-6 underline underline-offset-4"
        >
          {CUSTOMER_CONTACT.phoneDisplay}
        </a>
        <noscript>
          <p className="mt-4 text-sm text-muted">
            The online form needs JavaScript. Please call to request your quote.
          </p>
        </noscript>
      </div>
    </main>
  );
}

export function RequestForm() {
  return (
    <Suspense fallback={<RequestFormFallback />}>
      <RequestFormFields />
    </Suspense>
  );
}
