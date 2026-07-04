"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

const TECHNICIAN_NAME_KEY = "squeegeeos-tech-name";

interface PropertyHealthCheckFormProps {
  propertyId: string;
  propertyLabel: string;
  propertyAddress?: string;
  visitId?: string;
  cancelHref: string;
  successHref: string;
}

export function PropertyHealthCheckForm({
  propertyId,
  propertyLabel,
  propertyAddress,
  visitId,
  cancelHref,
  successHref,
}: PropertyHealthCheckFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<HealthCheckFormState>(() => ({
    propertyId,
    visitId,
    technicianName: "",
    visitDate: new Date().toISOString().split("T")[0]!,
    scores: emptyHealthScores(),
    internalNote: "",
    customerNote: "",
    customerNoteVisible: false,
  }));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(TECHNICIAN_NAME_KEY);
    if (stored) {
      setForm((prev) => ({ ...prev, technicianName: stored }));
    }
  }, []);

  const overallScore = calculateOverallScore(form.scores);
  const hasAnyScore = Object.values(form.scores).some((v) => v !== null);

  const setScore = (key: keyof HealthScores, value: number) => {
    setForm((prev) => ({
      ...prev,
      scores: { ...prev.scores, [key]: value },
    }));
  };

  const handleSubmit = async () => {
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

      window.localStorage.setItem(TECHNICIAN_NAME_KEY, form.technicianName.trim());
      setSaved(true);
      setTimeout(() => router.push(successHref), 1800);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center text-white">
        <div className="mb-5 text-5xl">✦</div>
        <h2 className="mb-2 font-serif text-2xl">Health Check Saved</h2>
        {overallScore !== null && (
          <p className="mb-1 text-xl text-[#c9a96e]">
            {overallScore}% overall care score
          </p>
        )}
        <p className="mt-2 text-sm text-[#444]">
          {propertyLabel}&apos;s memory has been updated.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-20">
      <div className="mb-8">
        <p className="mb-1 text-[10px] uppercase tracking-widest text-[#555]">
          This visit · {propertyLabel}
        </p>
        <h1 className="font-serif text-2xl text-white">Property Health Check</h1>
        {propertyAddress && (
          <p className="mt-1 text-sm text-[#666]">{propertyAddress}</p>
        )}
        <p className="mt-2 text-sm text-[#555]">
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

        <label className="block rounded-xl bg-[#111] px-4 py-3">
          <span className="text-sm font-medium text-[#bbb]">Visit date</span>
          <input
            type="date"
            value={form.visitDate}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, visitDate: e.target.value }))
            }
            className="mt-2 w-full bg-transparent text-sm text-white outline-none"
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
        {saving ? "Saving..." : "Save This Visit"}
      </button>

      <p className="mt-3 text-center text-xs text-[#333]">
        Score at least one category to save.
      </p>

      <Link
        href={cancelHref}
        className="mt-6 block text-center text-xs text-[#444] underline underline-offset-2"
      >
        Back to property
      </Link>
    </div>
  );
}
