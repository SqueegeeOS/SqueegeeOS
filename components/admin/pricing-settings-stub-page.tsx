"use client";

import Link from "next/link";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { isAdminUnlocked } from "@/lib/admin/pin";
import { COMPANY_SETTINGS } from "@/lib/pricing/company-settings";
import { formatDollars } from "@/lib/pricing/format";
import { ROUTES } from "@/lib/navigation/config";
import { useState } from "react";

/**
 * Stub for future HQ ⚙ Pricing Settings panel.
 * Will read/write COMPANY_SETTINGS without deployment.
 */
export function PricingSettingsStubPage() {
  const [unlocked, setUnlocked] = useState(() => isAdminUnlocked());

  if (!unlocked) {
    return <AdminPinGate onUnlock={() => setUnlocked(true)} />;
  }

  const { rates, interiorMultiplier, oneTimePremium, minimumQuoteSqft, maximumQuoteSqft } =
    COMPANY_SETTINGS;

  return (
    <div className="min-h-[100svh] bg-background pb-24">
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
        <Link
          href={ROUTES.hqCarePlanBuilder}
          className="text-[10px] uppercase tracking-[0.22em] text-muted transition-colors hover:text-accent"
        >
          ← Home Care Plan Builder
        </Link>

        <header className="mt-8 border-b border-border/70 pb-10">
          <p className="text-[10px] uppercase tracking-[0.32em] text-muted">
            Atlas Pricing Engine · Settings stub
          </p>
          <h1 className="mt-3 font-serif text-4xl font-light text-foreground">
            Pricing Settings
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Read-only view of <code className="text-accent">COMPANY_SETTINGS</code>.
            Future panel: edit rates here — every quote surface updates automatically.
          </p>
        </header>

        <dl className="mt-10 space-y-4 rounded-[1.75rem] border border-border/70 bg-surface/40 p-6 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Sq ft range</dt>
            <dd>
              {minimumQuoteSqft.toLocaleString()} – {maximumQuoteSqft.toLocaleString()}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Every 3 Months rate</dt>
            <dd>
              {formatDollars(Math.round(rates.quarterly.ratePerSqft * 1000))} / 1,000 sq
              ft · {rates.quarterly.annualVisits} visits/yr
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Every 6 Months rate</dt>
            <dd>
              {formatDollars(Math.round(rates.bi_annual.ratePerSqft * 1000))} / 1,000 sq
              ft · {rates.bi_annual.annualVisits} visits/yr
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Interior multiplier</dt>
            <dd>×{interiorMultiplier}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">One-time premium</dt>
            <dd>{formatDollars(oneTimePremium)}</dd>
          </div>
        </dl>

        <p className="mt-8 text-xs text-muted/80 italic">
          Editing requires Atlas Pricing Engine v2 settings persistence. Until then,
          update <code>lib/pricing/company-settings.ts</code> as company law.
        </p>
      </div>
    </div>
  );
}
