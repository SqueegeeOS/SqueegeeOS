"use client";

import { useEffect, useState } from "react";
import type { PublicEnrollmentStatus } from "@/lib/enrollment/public-status";

function money(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
function Step({
  label,
  detail,
  state,
}: {
  label: string;
  detail: string;
  state: "done" | "current" | "next";
}) {
  return (
    <li className="grid grid-cols-[2rem_1fr] gap-3">
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold ${
          state === "done"
            ? "border-emerald-300/40 bg-emerald-300/15 text-emerald-100"
            : state === "current"
              ? "border-[#d4c29c]/50 bg-[#d4c29c]/15 text-[#f2e6ca] shadow-[0_0_24px_rgba(212,194,156,0.14)]"
              : "border-white/10 bg-white/[0.03] text-white/30"
        }`}
      >
        {state === "done" ? "✓" : "•"}
      </span>
      <span className="pb-5">
        <strong className="block text-sm font-medium text-white/90">{label}</strong>
        <span className="mt-1 block text-xs leading-relaxed text-white/45">{detail}</span>
      </span>
    </li>
  );
}

export function EnrollmentHandoffPage({
  token,
  initialStatus,
  paymentResult,
}: {
  token: string;
  initialStatus: PublicEnrollmentStatus;
  paymentResult?: string | null;
}) {
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    if (
      paymentResult !== "success" ||
      status.status === "portal_ready"
    ) {
      return;
    }
    let attempts = 0;
    const interval = window.setInterval(async () => {
      attempts += 1;
      try {
        const response = await fetch(`/api/enrollment/${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        if (response.ok) {
          const next = (await response.json()) as PublicEnrollmentStatus;
          setStatus(next);
          if (next.status === "portal_ready") window.clearInterval(interval);
        }
      } catch {
        // Stripe's verified webhook remains the source of truth. A temporary
        // browser/network miss simply leaves this calm progress state visible.
      }
      if (attempts >= 20) window.clearInterval(interval);
    }, 3000);
    return () => window.clearInterval(interval);
  }, [paymentResult, status.status, token]);

  const agreementState = status.agreementComplete ? "done" : "current";
  const paymentState = status.paymentComplete
    ? "done"
    : status.agreementComplete
      ? "current"
      : "next";
  const portalState = status.portalUrl
    ? "done"
    : status.paymentComplete
      ? "current"
      : "next";
  const manualPayment = status.paymentRail === "manual_cash_check";

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#08100c] px-5 py-10 text-[#f6f1e7] sm:px-8 sm:py-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_5%,rgba(45,97,66,0.34),transparent_35%),radial-gradient(circle_at_90%_90%,rgba(212,194,156,0.12),transparent_32%)]" />
      <div className="relative mx-auto max-w-xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#d4c29c]/75">
              HomeAtlas handoff
            </p>
            <p className="mt-2 text-xs text-white/35">Powered by SqueegeeKing</p>
          </div>
          <span className="rounded-full border border-emerald-300/15 bg-emerald-300/[0.06] px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-emerald-100/75">
            Private link
          </span>
        </header>

        <section className="rounded-[2rem] border border-white/[0.09] bg-white/[0.045] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:p-9">
          <p className="text-sm text-[#d4c29c]">Hey {status.customerFirstName}.</p>
          <h1 className="mt-3 font-serif text-4xl font-light leading-[1.05] sm:text-5xl">
            Your home-care plan is becoming real.
          </h1>
          <p className="mt-5 text-sm leading-relaxed text-white/52">
            {status.propertyAddress} · {status.planName} · {status.cadence}
          </p>

          <div className="mt-7 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/[0.08] bg-black/15 p-4">
              <span className="text-[9px] uppercase tracking-[0.16em] text-white/35">First visit</span>
              <strong className="mt-2 block font-serif text-2xl font-light">{money(status.firstVisitPriceCents)}</strong>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-black/15 p-4">
              <span className="text-[9px] uppercase tracking-[0.16em] text-white/35">Continuing visits</span>
              <strong className="mt-2 block font-serif text-2xl font-light">{money(status.recurringVisitPriceCents)}</strong>
            </div>
          </div>

          <ol className="mt-8">
            <Step
              label="Clear agreement"
              detail={status.agreementComplete ? "Your DocuSign packet is complete and safely on file." : `DocuSign sent the agreement to ${status.maskedEmail}.`}
              state={agreementState}
            />
            <Step
              label={manualPayment ? "Cash/check arrangement" : "Secure card setup"}
              detail={
                manualPayment
                  ? status.paymentComplete
                    ? "Your owner-approved cash/check account is recorded. No automatic card charge is enabled."
                    : "HomeAtlas is recording the approved cash/check arrangement without creating a card setup."
                  : status.paymentComplete
                    ? "Stripe confirmed your saved payment method. No card number lives in HomeAtlas."
                    : "A separate Stripe page keeps payment details out of the agreement and off our servers."
              }
              state={paymentState}
            />
            <Step
              label="Your home, remembered"
              detail={status.portalUrl ? "Your private HomeAtlas portal is ready." : "Photos, visits, notes, care choices, and the next appointment will live together here."}
              state={portalState}
            />
          </ol>

          {paymentResult === "cancelled" && !status.paymentComplete ? (
            <p className="mb-4 rounded-xl border border-[#d4c29c]/20 bg-[#d4c29c]/[0.07] px-4 py-3 text-xs leading-relaxed text-[#efe1c3]">
              No worries — Stripe setup was closed and nothing was charged. You can pick up right here.
            </p>
          ) : null}
          {status.needsHelp ? (
            <p className="mb-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.07] px-4 py-3 text-xs leading-relaxed text-amber-100">
              We&apos;re giving this handoff a quick human check. Your agreement is safe; SqueegeeKing will follow up if anything is needed.
            </p>
          ) : null}

          {status.portalUrl ? (
            <a
              href={status.portalUrl}
              className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#d4c29c] px-5 text-sm font-bold text-[#102017] transition hover:bg-[#eadbb9]"
            >
              Open my home
            </a>
          ) : status.paymentUrl ? (
            <a
              href={status.paymentUrl}
              className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#d4c29c] px-5 text-sm font-bold text-[#102017] transition hover:bg-[#eadbb9]"
            >
              Continue securely on Stripe
            </a>
          ) : paymentResult === "success" ? (
            <div className="rounded-2xl border border-white/[0.09] bg-white/[0.04] px-5 py-4 text-center text-sm text-white/60">
              Stripe is confirming your card and opening your home…
            </div>
          ) : null}

          <p className="mt-5 text-center text-[11px] leading-relaxed text-white/28">
            {manualPayment
              ? "No card is stored and automatic card billing is disabled. Questions? Reply to the SqueegeeKing email that brought you here."
              : "No payment is collected during card setup. Questions? Reply to the SqueegeeKing email that brought you here."}
          </p>
        </section>
      </div>
    </main>
  );
}
