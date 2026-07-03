"use client";

import { useState, type ChangeEvent } from "react";
import type { LegacyBaseline } from "@/lib/admin/legacy-baseline";
import {
  buildDefaultLegacyMilestones,
} from "@/lib/admin/legacy-baseline";
import { persistHeadquartersProfile } from "@/lib/admin/headquarters-profile-client";
import { LegacyBiography } from "./legacy-biography";

const inputClassName =
  "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/20";

const labelClassName =
  "mb-1.5 block text-[10px] uppercase tracking-[0.2em] text-muted";

function readPortraitFile(
  event: ChangeEvent<HTMLInputElement>,
  onRead: (dataUrl: string | null) => void,
) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => onRead(typeof reader.result === "string" ? reader.result : null);
  reader.readAsDataURL(file);
}

interface AdminLegacyHonorCardProps {
  baseline: LegacyBaseline;
  onSaved: (baseline: LegacyBaseline) => void;
}

export function AdminLegacyHonorCard({
  baseline,
  onSaved,
}: AdminLegacyHonorCardProps) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<LegacyBaseline>(baseline);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setSaveMessage(null);
    const draft: LegacyBaseline = {
      ...form,
      configured: true,
      onboardingComplete: true,
      fiveStarReviews: form.googleReviews,
      homesProtected: form.homesServed,
      activeMembers: form.recurringCustomers,
    };
    const next: LegacyBaseline = {
      ...draft,
      legacyMilestones: buildDefaultLegacyMilestones(draft),
    };
    const sync = await persistHeadquartersProfile(next);
    onSaved(sync.baseline);
    setSaveMessage(
      sync.source === "supabase" || sync.source === "migrated"
        ? "Saved to Cloud Headquarters."
        : sync.warning ?? "Saved on this device only.",
    );
    setEditing(false);
    setSaving(false);
  };

  if (!editing && baseline.onboardingComplete) {
    return (
      <LegacyBiography
        baseline={baseline}
        onEdit={() => {
          setForm(baseline);
          setEditing(true);
        }}
      />
    );
  }

  return (
    <article className="rounded-[2rem] border border-dashed border-border/80 bg-background/40 p-6 sm:p-8">
      <p className="text-[10px] uppercase tracking-[0.28em] text-muted">
        Update Archive Record
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Adjust the permanent legacy record. These values are honored — never
        auto-generated.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {[
          { key: "portraitNoah" as const, label: "Noah portrait" },
          { key: "portraitDasan" as const, label: "Dasan portrait" },
        ].map((field) => (
          <div key={field.key}>
            <label className={labelClassName}>{field.label}</label>
            <input
              type="file"
              accept="image/*"
              className="block w-full text-xs text-muted file:mr-3 file:rounded-full file:border-0 file:bg-accent/10 file:px-4 file:py-2 file:text-[10px] file:uppercase file:tracking-[0.16em] file:text-accent"
              onChange={(e) =>
                readPortraitFile(e, (dataUrl) =>
                  setForm((prev) => ({ ...prev, [field.key]: dataUrl })),
                )
              }
            />
          </div>
        ))}
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label className={labelClassName}>Founded</label>
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
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { key: "googleReviews", label: "Google reviews" },
            { key: "homesServed", label: "Homes served" },
            { key: "lifetimeRevenue", label: "Lifetime revenue before platform" },
            { key: "recurringCustomers", label: "Recurring customers" },
          ].map((field) => (
            <div key={field.key}>
              <label className={labelClassName}>{field.label}</label>
              <input
                type="number"
                min={0}
                className={inputClassName}
                value={form[field.key as keyof LegacyBaseline] as number}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    [field.key]: Number(e.target.value) || 0,
                  }))
                }
              />
            </div>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClassName}>Largest month</label>
            <input
              className={inputClassName}
              value={form.largestMonth}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, largestMonth: e.target.value }))
              }
            />
          </div>
          <div>
            <label className={labelClassName}>Largest job</label>
            <input
              className={inputClassName}
              value={form.largestJob}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, largestJob: e.target.value }))
              }
            />
          </div>
        </div>
        {[
          { key: "aboutNoah", label: "About Noah" },
          { key: "aboutDasan", label: "About Dasan" },
          { key: "companyStandFor", label: "Company story" },
        ].map((field) => (
          <div key={field.key}>
            <label className={labelClassName}>{field.label}</label>
            <textarea
              rows={3}
              className={inputClassName}
              value={form[field.key as keyof LegacyBaseline] as string}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, [field.key]: e.target.value }))
              }
            />
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="rounded-full border border-accent/30 bg-accent/[0.08] px-5 py-2.5 text-[10px] uppercase tracking-[0.2em] text-accent disabled:opacity-50"
        >
          {saving ? "Saving…" : "Seal archive"}
        </button>
        {saveMessage && (
          <p className="text-xs text-muted">{saveMessage}</p>
        )}
        {baseline.onboardingComplete && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-full border border-border px-5 py-2.5 text-[10px] uppercase tracking-[0.2em] text-muted"
          >
            Cancel
          </button>
        )}
      </div>
    </article>
  );
}
