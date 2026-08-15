"use client";

import { useMemo, useState } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import type { JobberTodayVisit } from "@/lib/care-operations/jobber-today-types";
import {
  fieldReviewCountsAsBoughtBackTime,
  type FieldIndependenceReview,
  type FieldJobClass,
  type FieldQualityOutcome,
  type OwnerInvolvement,
} from "@/lib/field-operations/independence-review";

const INVOLVEMENT_OPTIONS: Array<{
  value: OwnerInvolvement;
  label: string;
}> = [
  { value: "none", label: "No owner help" },
  { value: "remote_guidance", label: "Remote guidance" },
  { value: "onsite_assist", label: "On-site assist" },
  { value: "owner_led", label: "Owner led the job" },
];

const QUALITY_OPTIONS: Array<{
  value: FieldQualityOutcome;
  label: string;
}> = [
  { value: "verified", label: "Quality verified" },
  { value: "follow_up", label: "Follow-up needed" },
  { value: "rework", label: "Rework required" },
  { value: "safety_stop", label: "Safety stop" },
];

function hoursLabel(minutes: number | null): string {
  if (minutes == null) return "Duration unavailable";
  const hours = minutes / 60;
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(hours)} verified hr${hours === 1 ? "" : "s"}`;
}

function reviewLabel(review: FieldIndependenceReview): string {
  if (review.qualityOutcome === "rework") return "Rework recorded";
  if (review.qualityOutcome === "safety_stop") return "Safety stop recorded";
  if (review.qualityOutcome === "follow_up") return "Follow-up recorded";
  if (review.ownerInvolvement !== "none") return "Owner help recorded";
  if (review.jobClass === "exceptional") return "Exceptional job";
  return "Verified independent";
}

export function FieldIndependenceReviewPanel({
  visit,
  onSaved,
}: {
  visit: JobberTodayVisit;
  onSaved: () => void;
}) {
  const review = visit.homeAtlasIndependenceReview;
  const assignedUsers = visit.assignedUsers;
  const defaultTechnicianId =
    review?.technicianJobberUserId ??
    (assignedUsers.length === 1 ? assignedUsers[0]!.id : "");
  const [formOpen, setFormOpen] = useState(false);
  const [technicianId, setTechnicianId] = useState(defaultTechnicianId);
  const [jobClass, setJobClass] = useState<FieldJobClass>(
    review?.jobClass ?? "normal",
  );
  const [ownerInvolvement, setOwnerInvolvement] = useState<OwnerInvolvement>(
    review?.ownerInvolvement ?? "none",
  );
  const [ownerMinutes, setOwnerMinutes] = useState(
    review?.ownerMinutes ?? 0,
  );
  const [qualityOutcome, setQualityOutcome] = useState<FieldQualityOutcome>(
    review?.qualityOutcome ?? "verified",
  );
  const [note, setNote] = useState(review?.reviewNote ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasOpenException = visit.homeAtlasOpenFollowUpCount > 0;
  const currentlyCounts = useMemo(
    () =>
      review
        ? fieldReviewCountsAsBoughtBackTime(review, hasOpenException)
        : false,
    [hasOpenException, review],
  );

  if (
    !visit.isComplete ||
    !visit.homeAtlasAppointmentId ||
    !visit.homeAtlasPropertyId ||
    visit.homeAtlasFieldRecordCount === 0 ||
    visit.assignmentReadState !== "available" ||
    assignedUsers.length === 0
  ) {
    return null;
  }

  async function saveReview(input: {
    technicianJobberUserId: string;
    jobClass: FieldJobClass;
    ownerInvolvement: OwnerInvolvement;
    ownerMinutes: number;
    qualityOutcome: FieldQualityOutcome;
    reviewNote?: string;
  }) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/owner-leverage", {
        method: "POST",
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({
          action: "record_field_review",
          appointmentId: visit.homeAtlasAppointmentId,
          propertyId: visit.homeAtlasPropertyId,
          ...input,
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | { review?: FieldIndependenceReview; error?: string }
        | null;
      if (!response.ok || !body?.review) {
        throw new Error(body?.error ?? "Could not save the field review.");
      }
      setFormOpen(false);
      onSaved();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save the field review.",
      );
    } finally {
      setSaving(false);
    }
  }

  const canQuickVerify = Boolean(technicianId) && !hasOpenException;

  return (
    <div className="mt-4 rounded-2xl border border-violet-300/20 bg-violet-300/[0.055] p-4 sm:p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-[10px] uppercase tracking-[0.17em] text-violet-200/75">
            Owner time buyback
          </p>
          <h3 className="mt-1.5 text-sm font-medium text-foreground">
            Did this normal job run without Noah?
          </h3>
          <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-muted">
            HomeAtlas counts the time only after the completed Jobber visit,
            closeout proof, quality result, and owner involvement are explicit.
          </p>
        </div>
        {review ? (
          <span
            className={`self-start rounded-full border px-3 py-1 text-[10px] ${
              currentlyCounts
                ? "border-emerald-300/30 bg-emerald-300/[0.08] text-emerald-100"
                : "border-amber-300/25 bg-amber-300/[0.07] text-amber-100"
            }`}
          >
            {reviewLabel(review)}
          </span>
        ) : null}
      </div>

      {review && !formOpen ? (
        <div className="mt-4 flex flex-col justify-between gap-3 rounded-xl border border-white/10 bg-black/15 p-3 sm:flex-row sm:items-center">
          <div className="text-xs text-white/55">
            <span className="font-medium text-white/80">
              {review.technicianDisplayName}
            </span>{" "}
            · {hoursLabel(review.productionMinutes)} · {review.ownerMinutes} owner min
            {!currentlyCounts && hasOpenException
              ? " · paused by open field exception"
              : ""}
          </div>
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="min-h-10 rounded-full border border-white/15 px-4 text-xs text-white/65"
          >
            Edit review
          </button>
        </div>
      ) : null}

      {!review && !formOpen ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={!canQuickVerify || saving}
            onClick={() =>
              void saveReview({
                technicianJobberUserId: technicianId,
                jobClass: "normal",
                ownerInvolvement: "none",
                ownerMinutes: 0,
                qualityOutcome: "verified",
              })
            }
            className="min-h-12 rounded-xl border border-emerald-300/30 bg-emerald-300/[0.09] px-4 text-sm font-medium text-emerald-100 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Verified independent"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => setFormOpen(true)}
            className="min-h-12 rounded-xl border border-white/15 px-4 text-sm text-white/65 disabled:opacity-40"
          >
            Record help or exception
          </button>
        </div>
      ) : null}

      {assignedUsers.length > 1 && !review && !formOpen ? (
        <label className="mt-3 block text-[11px] text-muted">
          Choose the primary technician first
          <select
            value={technicianId}
            onChange={(event) => setTechnicianId(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-[#111] px-3 text-sm text-white"
          >
            <option value="">Select technician</option>
            {assignedUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {hasOpenException && !formOpen ? (
        <p className="mt-3 text-[11px] leading-relaxed text-amber-100/75">
          This visit has an open field follow-up, so it cannot count as bought-back
          time until the exception is resolved.
        </p>
      ) : null}

      {formOpen ? (
        <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2">
          <label className="text-[11px] text-muted">
            Primary technician
            <select
              value={technicianId}
              onChange={(event) => setTechnicianId(event.target.value)}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-white/15 bg-[#111] px-3 text-sm text-white"
            >
              <option value="">Select technician</option>
              {assignedUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-muted">
            Job type
            <select
              value={jobClass}
              onChange={(event) => setJobClass(event.target.value as FieldJobClass)}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-white/15 bg-[#111] px-3 text-sm text-white"
            >
              <option value="normal">Normal production job</option>
              <option value="exceptional">Exceptional / training job</option>
            </select>
          </label>
          <label className="text-[11px] text-muted">
            Owner involvement
            <select
              value={ownerInvolvement}
              onChange={(event) => {
                const next = event.target.value as OwnerInvolvement;
                setOwnerInvolvement(next);
                setOwnerMinutes(next === "none" ? 0 : Math.max(1, ownerMinutes || 15));
              }}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-white/15 bg-[#111] px-3 text-sm text-white"
            >
              {INVOLVEMENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-muted">
            Owner minutes
            <input
              type="number"
              inputMode="numeric"
              min={ownerInvolvement === "none" ? 0 : 1}
              max={960}
              disabled={ownerInvolvement === "none"}
              value={ownerMinutes}
              onChange={(event) => setOwnerMinutes(Number(event.target.value))}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-white/15 bg-[#111] px-3 text-sm text-white disabled:opacity-45"
            />
          </label>
          <label className="text-[11px] text-muted sm:col-span-2">
            Quality outcome
            <select
              value={qualityOutcome}
              onChange={(event) =>
                setQualityOutcome(event.target.value as FieldQualityOutcome)
              }
              className="mt-1.5 min-h-11 w-full rounded-xl border border-white/15 bg-[#111] px-3 text-sm text-white"
            >
              {QUALITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-muted sm:col-span-2">
            Short context (optional)
            <textarea
              rows={3}
              maxLength={2_000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What required help, what Jarad handled well, or what should change next time?"
              className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#111] px-3 py-3 text-sm text-white"
            />
          </label>
          {error ? (
            <p className="text-xs text-red-200 sm:col-span-2">{error}</p>
          ) : null}
          <div className="grid grid-cols-2 gap-2 sm:col-span-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => setFormOpen(false)}
              className="min-h-11 rounded-xl border border-white/15 text-xs text-white/60 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !technicianId}
              onClick={() =>
                void saveReview({
                  technicianJobberUserId: technicianId,
                  jobClass,
                  ownerInvolvement,
                  ownerMinutes,
                  qualityOutcome,
                  reviewNote: note,
                })
              }
              className="min-h-11 rounded-xl border border-violet-200/30 bg-violet-200/[0.1] text-xs font-medium text-violet-100 disabled:opacity-40"
            >
              {saving ? "Saving review…" : "Save review"}
            </button>
          </div>
        </div>
      ) : null}

      {error && !formOpen ? (
        <p className="mt-3 text-xs text-red-200">{error}</p>
      ) : null}
    </div>
  );
}
