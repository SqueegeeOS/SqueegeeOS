"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  contactMethods,
  emptyLeadForm,
  serviceOptions,
  type LeadIntakeFormData,
} from "@/lib/acquisition/types";
import { CUSTOMER_BRAND, CUSTOMER_CTAS } from "@/lib/brand/customer";
import { RequestPlanTransition } from "@/components/experience/request-plan-transition";
import { AmbientGlow, Eyebrow, Reveal, easeLuxury } from "@/components/marketing/ui";

const inputClassName =
  "w-full rounded-2xl border border-border bg-surface px-4 py-3.5 text-base text-foreground placeholder:text-muted/60 focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/20";

type FormPhase = "form" | "transition" | "thanks";

function ThankYouScreen({ firstName }: { firstName: string }) {
  return (
    <motion.div
      className="relative min-h-screen overflow-x-hidden bg-background px-5 py-28 sm:px-10 sm:py-32"
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

export function RequestForm() {
  const [form, setForm] = useState<LeadIntakeFormData>(emptyLeadForm);
  const [phase, setPhase] = useState<FormPhase>("form");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleService = (service: (typeof serviceOptions)[number]) => {
    setForm((prev) => ({
      ...prev,
      servicesInterested: prev.servicesInterested.includes(service)
        ? prev.servicesInterested.filter((s) => s !== service)
        : [...prev.servicesInterested, service],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    window.setTimeout(() => setPhase("transition"), 180);
  };

  const firstName = form.name.split(" ")[0] || "friend";

  if (phase === "thanks") {
    return <ThankYouScreen firstName={firstName} />;
  }

  return (
    <>
      <div className="relative min-h-screen overflow-x-hidden bg-background pb-24">
        <AmbientGlow />

        <div className="relative mx-auto max-w-xl px-5 pt-[max(2.5rem,env(safe-area-inset-top))] sm:px-0 sm:pt-20">
          <Reveal>
            <Link
              href="/"
              className="inline-block min-h-[44px] py-2 text-[11px] uppercase tracking-[0.26em] text-muted transition-colors hover:text-accent"
            >
              ← {CUSTOMER_BRAND.name}
            </Link>
            <div className="mt-12">
              <Eyebrow>Request Your Plan</Eyebrow>
            </div>
            <h1 className="mt-6 font-serif text-[2rem] font-light leading-[1.1] tracking-tight text-foreground sm:text-4xl">
              Begin your Home Care Plan.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted">
              Tell us about your property. We&apos;ll schedule an inspection and
              craft your personalized experience.
            </p>
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

              <motion.button
                type="submit"
                disabled={isSubmitting}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.12, ease: easeLuxury }}
                className="w-full min-h-[52px] rounded-full border border-accent/40 bg-accent text-sm font-medium tracking-[0.12em] text-background touch-manipulation transition-opacity hover:opacity-95 disabled:opacity-90 sm:text-base"
              >
                {CUSTOMER_CTAS.requestPlan}
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
