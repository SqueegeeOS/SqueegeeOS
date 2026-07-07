"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  craftEyebrow,
  craftGhostLink,
  craftInput,
  craftLabel,
  craftPrimaryButton,
  craftTextarea,
} from "@/lib/craft/tokens";
import type {
  AssessmentFormState,
  RecommendedService,
} from "@/lib/health/assessment-types";

const TECHNICIAN_NAME_KEY = "squeegeeos-tech-name";

interface DocumentVisitFormProps {
  propertyId: string;
  propertyName: string;
  propertyAddress?: string;
  cancelHref: string;
  successHref: string;
  mode: "tech" | "founder";
}

function buildVisitNotePayload(
  propertyId: string,
  visitId: string | undefined,
  technicianName: string,
  visitDate: string,
  fields: {
    shortNote: string;
    customerSummary: string;
    internalNote: string;
    followUpNeeded: boolean;
  },
): AssessmentFormState {
  const recommendedServices: RecommendedService[] = fields.followUpNeeded
    ? [
        {
          id: "follow-up",
          service: "Follow-up recommended",
          priority: "medium",
          note: "",
        },
      ]
    : [];

  const customerSummary = fields.customerSummary.trim();
  const internalNote = fields.internalNote.trim() || fields.shortNote.trim();

  return {
    propertyId,
    visitId,
    technicianName: technicianName.trim(),
    visitDate,
    assessmentType: "visit_note",
    activeAreas: [],
    scores: {},
    naAreas: [],
    internalNote,
    customerNote: customerSummary,
    customerNoteVisible: customerSummary.length > 0,
    proposalSummary: fields.followUpNeeded ? "Follow-up recommended" : "",
    recommendedServices,
  };
}

export function DocumentVisitForm({
  propertyId,
  propertyName,
  propertyAddress,
  cancelHref,
  successHref,
  mode,
}: DocumentVisitFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const visitId = searchParams.get("visitId") ?? undefined;

  const [technicianName, setTechnicianName] = useState("");
  const [visitDate, setVisitDate] = useState(
    () => new Date().toISOString().split("T")[0]!,
  );
  const [shortNote, setShortNote] = useState("");
  const [customerSummary, setCustomerSummary] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [followUpNeeded, setFollowUpNeeded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(TECHNICIAN_NAME_KEY);
    if (stored) setTechnicianName(stored);
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const note =
      mode === "tech"
        ? shortNote.trim()
        : shortNote.trim() || internalNote.trim() || customerSummary.trim();

    if (!note) {
      setError("Add a visit note before saving.");
      return;
    }

    if (!technicianName.trim()) {
      setError("Enter your name before saving.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = buildVisitNotePayload(
      propertyId,
      visitId,
      technicianName,
      visitDate,
      {
        shortNote: mode === "tech" ? note : shortNote,
        customerSummary,
        internalNote: mode === "founder" ? internalNote : "",
        followUpNeeded,
      },
    );

    try {
      const response = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Save failed");
      }

      window.localStorage.setItem(TECHNICIAN_NAME_KEY, technicianName.trim());
      router.push(successHref);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      <header>
        <p className={craftEyebrow}>
          {mode === "tech" ? "Document visit" : "HQ · Document visit"}
        </p>
        <h1 className="mt-3 font-serif text-2xl font-light tracking-[-0.02em] text-white sm:text-3xl">
          {propertyName}
        </h1>
        {propertyAddress ? (
          <p className="mt-2 text-sm leading-relaxed text-foreground/55">
            {propertyAddress}
          </p>
        ) : null}
      </header>

      <label className="block">
        <span className={craftLabel}>
          Your name
        </span>
        <input
          value={technicianName}
          onChange={(event) => setTechnicianName(event.target.value)}
          placeholder="Technician name"
          className={craftInput}
        />
      </label>

      <label className="block">
        <span className={craftLabel}>
          Visit date
        </span>
        <input
          type="date"
          value={visitDate}
          onChange={(event) => setVisitDate(event.target.value)}
          className={craftInput}
        />
      </label>

      <label className="block">
        <span className={craftLabel}>
          {mode === "tech" ? "Visit note" : "Short note"}
        </span>
        <textarea
          value={shortNote}
          onChange={(event) => setShortNote(event.target.value)}
          placeholder={
            mode === "tech"
              ? "What did you see today? Quick observations, access notes, anything worth remembering."
              : "Brief visit summary for the property record."
          }
          rows={mode === "tech" ? 5 : 4}
          className={craftTextarea}
        />
      </label>

      {mode === "founder" ? (
        <>
          <label className="block">
            <span className={craftLabel}>
              Customer-visible summary (optional)
            </span>
            <textarea
              value={customerSummary}
              onChange={(event) => setCustomerSummary(event.target.value)}
              placeholder="What the homeowner should see in their portal."
              rows={3}
              className={craftTextarea}
            />
          </label>

          <label className="block">
            <span className={craftLabel}>
              Internal note (optional)
            </span>
            <textarea
              value={internalNote}
              onChange={(event) => setInternalNote(event.target.value)}
              placeholder="Founder-only context. Never shown in the customer portal."
              rows={3}
              className={craftTextarea}
            />
          </label>
        </>
      ) : null}

      <label className="craft-glass-subtle flex items-start gap-3 rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-ambient)]">
        <input
          type="checkbox"
          checked={followUpNeeded}
          onChange={(event) => setFollowUpNeeded(event.target.checked)}
          className="mt-1"
        />
        <span>
          <span className="block text-sm text-foreground">Follow-up recommended</span>
          <span className="mt-1 block text-xs leading-relaxed text-muted">
            Flags this visit for a future recommendation or callback.
          </span>
        </span>
      </label>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <button type="submit" disabled={saving} className={`w-full ${craftPrimaryButton}`}>
        {saving ? "Saving…" : "Save visit memory"}
      </button>

      <Link href={cancelHref} className={`block text-center ${craftGhostLink}`}>
        Cancel
      </Link>
    </form>
  );
}
