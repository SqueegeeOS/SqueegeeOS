"use client";

import { useState } from "react";
import { PortalCard } from "@/components/portal/portal-section";
import {
  type MembershipVisitPreference,
  VISIT_MONTHS,
  monthName,
} from "@/lib/membership/visit-preferences";
import { craftInput, craftPrimaryButton } from "@/lib/craft/tokens";

interface PreferredVisitMonthsProps {
  preferences: MembershipVisitPreference[];
  visitsPerYear: number;
  portalToken: string | null;
}

function starterMonths(count: number): number[] {
  return Array.from({ length: count }, () => 0);
}

export function PreferredVisitMonths({
  preferences,
  visitsPerYear,
  portalToken,
}: PreferredVisitMonthsProps) {
  const count = preferences.length || visitsPerYear;
  const [months, setMonths] = useState<number[]>(() =>
    preferences.length
      ? preferences.map((item) => item.preferredMonth ?? 0)
      : starterMonths(count),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (count < 1) return null;

  const save = async () => {
    if (!portalToken) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/portal/visit-preferences", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: portalToken, months }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not save");
      setMessage("Saved — we’ll use these months when planning your visits.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {Array.from({ length: count }, (_, index) => {
        const preference = preferences[index];
        return (
          <PortalCard key={preference?.id ?? `visit-${index + 1}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-accent/75">
                  Visit {index + 1}
                </p>
                {preference?.serviceSummary ? (
                  <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                    {preference.serviceSummary}
                  </p>
                ) : null}
                {preference?.timingNote ? (
                  <p className="mt-2 text-xs leading-relaxed text-foreground/50">
                    {preference.timingNote}
                  </p>
                ) : null}
              </div>
              {preference?.visitPrice != null ? (
                <p className="shrink-0 text-sm text-foreground/70">
                  ${preference.visitPrice.toLocaleString("en-US")}
                </p>
              ) : null}
            </div>
            <label className="mt-4 block">
              <span className="text-[10px] uppercase tracking-[0.16em] text-foreground/45">
                Preferred month
              </span>
              {portalToken && (preference?.customerEditableMonth ?? true) ? (
                <select
                  value={months[index] ?? 0}
                  onChange={(event) =>
                    setMonths((current) =>
                      current.map((month, monthIndex) =>
                        monthIndex === index ? Number(event.target.value) : month,
                      ),
                    )
                  }
                  className={`mt-2 w-full ${craftInput}`}
                >
                  <option value={0}>Choose a month</option>
                  {VISIT_MONTHS.map((label, monthIndex) => (
                    <option key={label} value={monthIndex + 1}>
                      {label}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="mt-1 text-sm text-foreground/80">
                  {monthName(months[index] ?? null)}
                </p>
              )}
            </label>
          </PortalCard>
        );
      })}
      {portalToken ? (
        <>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className={`w-full ${craftPrimaryButton} disabled:opacity-50`}
          >
            {saving ? "Saving…" : "Save preferred months"}
          </button>
          {message ? (
            <p className="text-center text-xs leading-relaxed text-foreground/55">
              {message}
            </p>
          ) : null}
        </>
      ) : null}
      <p className="text-xs leading-relaxed text-foreground/45">
        Preferred months help us plan your care. Your confirmed service date will
        still appear separately once it is booked.
      </p>
    </div>
  );
}
