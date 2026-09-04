"use client";

import { useState } from "react";
import { craftInput, craftPrimaryButton } from "@/lib/craft/tokens";
import { createLeadSubmissionId } from "@/lib/acquisition/lead-submission-id";
import { serviceOptions, type ServiceOption } from "@/lib/acquisition/types";

interface TechnicianReferralFormProps {
  technicianName: string;
  previewOnly: boolean;
}

const inputClass = `${craftInput} min-h-12 text-base`;

export function TechnicianReferralForm({
  technicianName,
  previewOnly,
}: TechnicianReferralFormProps) {
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [permissionConfirmed, setPermissionConfirmed] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function toggleService(service: ServiceOption) {
    setServices((current) =>
      current.includes(service)
        ? current.filter((item) => item !== service)
        : [...current, service],
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (previewOnly) {
      setSuccess("Preview complete. A real technician submission will appear in HQ with their credit locked.");
      return;
    }

    const form = new FormData(event.currentTarget);
    setWorking(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/field/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: createLeadSubmissionId(),
          name: form.get("name"),
          phone: form.get("phone"),
          email: form.get("email"),
          serviceAddress: form.get("serviceAddress"),
          notes: form.get("notes"),
          servicesInterested: services,
          permissionConfirmed,
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string; creditedTo?: string }
        | null;
      if (!response.ok) throw new Error(body?.error ?? "Could not save that referral.");
      setSuccess(`Sent to HQ. Referral credit is locked to ${body?.creditedTo ?? technicianName}.`);
      event.currentTarget.reset();
      setServices([]);
      setPermissionConfirmed(false);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Could not save that referral.",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-6">
      <div className="grid gap-4">
        <label className="grid gap-2 text-xs uppercase tracking-[0.16em] text-muted">
          Customer name
          <input name="name" required autoComplete="name" className={inputClass} placeholder="First and last name" />
        </label>
        <label className="grid gap-2 text-xs uppercase tracking-[0.16em] text-muted">
          Mobile number
          <input name="phone" required inputMode="tel" autoComplete="tel" className={inputClass} placeholder="(555) 555-5555" />
        </label>
        <label className="grid gap-2 text-xs uppercase tracking-[0.16em] text-muted">
          Email <span className="normal-case tracking-normal text-muted">optional</span>
          <input name="email" type="email" autoComplete="email" className={inputClass} placeholder="name@example.com" />
        </label>
        <label className="grid gap-2 text-xs uppercase tracking-[0.16em] text-muted">
          Service address <span className="normal-case tracking-normal text-muted">if known</span>
          <input name="serviceAddress" autoComplete="street-address" className={inputClass} placeholder="Street, city" />
        </label>
      </div>

      <fieldset>
        <legend className="text-xs uppercase tracking-[0.16em] text-muted">What are they interested in?</legend>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {serviceOptions.map((service) => {
            const selected = services.includes(service);
            return (
              <button
                key={service}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleService(service)}
                className={`min-h-14 rounded-2xl border px-3 text-left text-sm transition-colors ${
                  selected
                    ? "border-accent/50 bg-accent/12 text-accent"
                    : "border-foreground/10 bg-foreground/[0.035] text-foreground/60"
                }`}
              >
                {service}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="grid gap-2 text-xs uppercase tracking-[0.16em] text-muted">
        Helpful context <span className="normal-case tracking-normal text-muted">optional</span>
        <textarea name="notes" rows={4} className={`${inputClass} py-3`} placeholder="How you know them, best time to call, or what they mentioned." />
      </label>

      <label className="flex min-h-16 cursor-pointer gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4 text-sm leading-relaxed text-foreground/65">
        <input
          type="checkbox"
          checked={permissionConfirmed}
          onChange={(event) => setPermissionConfirmed(event.target.checked)}
          required
          className="mt-1 size-4 accent-accent"
        />
        <span>They asked Squeegee King to contact them about this service.</span>
      </label>

      {error ? <p role="alert" className="rounded-2xl border border-danger/25 bg-danger/[0.08] p-4 text-sm text-danger">{error}</p> : null}
      {success ? <p role="status" className="rounded-2xl border border-success/25 bg-success/[0.08] p-4 text-sm text-success">{success}</p> : null}

      <button
        type="submit"
        disabled={working || services.length === 0 || !permissionConfirmed}
        className={`${craftPrimaryButton} w-full`}
      >
        {working ? "Sending to HQ…" : previewOnly ? "Preview referral handoff" : "Send referral to HQ"}
      </button>
      <p className="text-center text-xs leading-relaxed text-muted">
        Credit: {technicianName} · Commission unlocks only after a closed sale and collected payment.
      </p>
    </form>
  );
}
