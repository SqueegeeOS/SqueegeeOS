"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ScoreRow } from "@/components/health/ScoreRow";
import { NoteField } from "@/components/health/NoteField";
import { HealthSummaryPreview } from "@/components/health/HealthSummaryPreview";
import {
  calculateOverallScore,
  emptyHealthScores,
  HEALTH_CATEGORY_LABELS,
  type HealthCheckFormState,
  type HealthScores,
} from "@/lib/health/types";

function HealthCheckForm() {
  const router = useRouter();
  const params = useSearchParams();

  const propertyId = params.get("propertyId") ?? "";
  const visitId = params.get("visitId") ?? undefined;
  const technicianFromQuery = params.get("technician") ?? "";

  const [form, setForm] = useState<HealthCheckFormState>({
    propertyId,
    visitId,
    technicianName: technicianFromQuery,
    visitDate: new Date().toISOString().split("T")[0]!,
    scores: emptyHealthScores(),
    internalNote: "",
    customerNote: "",
    customerNoteVisible: false,
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const overallScore = calculateOverallScore(form.scores);
  const hasAnyScore = Object.values(form.scores).some((v) => v !== null);

  const setScore = (key: keyof HealthScores, value: number) => {
    setForm((prev) => ({
      ...prev,
      scores: { ...prev.scores, [key]: value },
    }));
  };

  const handleSubmit = async () => {
    if (!propertyId) {
      setError("propertyId is required in the URL.");
      return;
    }
    if (!form.technicianName.trim()) {
      setError("Enter your name before saving.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/health-checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, propertyId }),
      });

      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        throw new Error(payload.error ?? "Save failed");
      }

      setSaved(true);
      setTimeout(() => {
        router.push(`/hq/properties/${propertyId}/health`);
      }, 2000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
      setSaving(false);
    }
  };

  if (!propertyId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-6 text-center text-white">
        <p className="font-serif text-xl">Property required</p>
        <p className="mt-2 text-sm text-[#555]">
          Open this form with{" "}
          <code className="text-[#888]">?propertyId=...</code>
        </p>
      </div>
    );
  }

  if (saved) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-6 text-center text-white">
        <div className="mb-5 text-5xl">✦</div>
        <h2 className="mb-2 font-serif text-2xl">Health Check Saved</h2>
        {overallScore !== null && (
          <p className="mb-1 text-xl text-[#c9a96e]">
            {overallScore}% overall care score
          </p>
        )}
        <p className="mt-2 text-sm text-[#444]">
          This home&apos;s memory has been updated.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-[#0a0a0a] px-4 py-8 pb-20 text-white">
      <div className="mb-8">
        <p className="mb-1 text-[10px] uppercase tracking-widest text-[#555]">
          Atlas · Home Memory
        </p>
        <h1 className="font-serif text-2xl text-white">Property Health Check</h1>
        <p className="mt-1 text-sm text-[#555]">
          Score each area. Add notes. Done.
        </p>
      </div>

      <div className="mb-6 space-y-2">
        <label className="block rounded-xl bg-[#111] px-4 py-3">
          <span className="text-sm font-medium text-[#bbb]">Technician</span>
          <input
            type="text"
            value={form.technicianName}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, technicianName: e.target.value }))
            }
            placeholder="Your name"
            className="mt-2 w-full bg-transparent text-sm text-white outline-none placeholder:text-[#333]"
          />
        </label>

        {(Object.keys(HEALTH_CATEGORY_LABELS) as Array<keyof HealthScores>).map(
          (key) => (
            <ScoreRow
              key={key}
              label={HEALTH_CATEGORY_LABELS[key]}
              value={form.scores[key]}
              onChange={(v) => setScore(key, v)}
            />
          ),
        )}
      </div>

      {overallScore !== null && (
        <HealthSummaryPreview score={overallScore} className="mb-6" />
      )}

      <div className="mb-8 space-y-3">
        <NoteField
          label="Internal Note"
          badge="Internal only"
          badgeColor="#666"
          placeholder="Gate code, dog schedule, sprinkler overspray..."
          value={form.internalNote}
          onChange={(v) => setForm((prev) => ({ ...prev, internalNote: v }))}
        />

        <NoteField
          label="Customer Care Note"
          badge={
            form.customerNoteVisible
              ? "Visible in customer portal"
              : "Hidden from customer"
          }
          badgeColor={form.customerNoteVisible ? "#c9a96e" : "#444"}
          placeholder="Your windows are in great shape..."
          value={form.customerNote}
          onChange={(v) => setForm((prev) => ({ ...prev, customerNote: v }))}
          footer={
            <button
              type="button"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  customerNoteVisible: !prev.customerNoteVisible,
                }))
              }
              className="mt-2 text-xs text-[#666] underline underline-offset-2 transition-colors active:text-[#c9a96e]"
            >
              {form.customerNoteVisible
                ? "Hide from customer portal"
                : "Make visible in customer portal"}
            </button>
          }
        />
      </div>

      {error && (
        <p className="mb-4 text-center text-sm text-red-400">{error}</p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={saving || !hasAnyScore}
        className="w-full rounded-xl bg-[#c9a96e] py-4 text-base font-medium tracking-wide text-black transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"
      >
        {saving ? "Saving..." : "Save Health Check"}
      </button>

      <p className="mt-3 text-center text-xs text-[#333]">
        Score at least one category to save.
      </p>

      <Link
        href={`/hq/properties/${propertyId}/health`}
        className="mt-6 block text-center text-xs text-[#444] underline underline-offset-2"
      >
        Cancel
      </Link>
    </div>
  );
}

export default function HealthCheckPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-[#555]">
          Loading…
        </div>
      }
    >
      <HealthCheckForm />
    </Suspense>
  );
}
