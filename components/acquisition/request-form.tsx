"use client";

import { useState } from "react";
import Link from "next/link";
import {
  contactMethods,
  emptyLeadForm,
  serviceOptions,
  type LeadIntakeFormData,
} from "@/lib/acquisition/types";
import { AmbientGlow, Eyebrow, Reveal } from "@/components/marketing/ui";

const inputClassName =
  "w-full rounded-2xl border border-border bg-surface px-4 py-3.5 text-base text-foreground placeholder:text-muted/60 focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/20";

export function RequestForm() {
  const [form, setForm] = useState<LeadIntakeFormData>(emptyLeadForm);
  const [submitted, setSubmitted] = useState(false);

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
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="relative min-h-screen overflow-x-hidden bg-background px-5 py-24 sm:px-10">
        <AmbientGlow />
        <div className="relative mx-auto max-w-lg text-center">
          <Eyebrow>Request Received</Eyebrow>
          <h1 className="mt-6 font-serif text-4xl font-light text-foreground sm:text-5xl">
            Thank you, {form.name.split(" ")[0] || "friend"}.
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
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background pb-16">
      <AmbientGlow />

      <div className="relative mx-auto max-w-xl px-5 pt-[max(2rem,env(safe-area-inset-top))] sm:px-0 sm:pt-16">
        <Reveal>
          <Link
            href="/"
            className="text-[11px] uppercase tracking-[0.28em] text-muted"
          >
            ← Squeegeeking
          </Link>
          <div className="mt-10">
            <Eyebrow>Request Your Plan</Eyebrow>
          </div>
          <h1 className="mt-5 font-serif text-[2rem] font-light leading-tight text-foreground sm:text-4xl">
            Begin your Home Care Plan.
          </h1>
          <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted sm:text-base">
            Tell us about your property. We&apos;ll schedule an inspection and
            craft your personalized experience.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <form onSubmit={handleSubmit} className="mt-10 space-y-6 sm:mt-12">
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
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
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
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
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

            <button
              type="submit"
              className="w-full min-h-[52px] rounded-full border border-accent/40 bg-accent text-sm font-medium tracking-[0.14em] text-background touch-manipulation sm:text-base"
            >
              Request My Home Care Plan
            </button>
          </form>
        </Reveal>
      </div>
    </div>
  );
}
