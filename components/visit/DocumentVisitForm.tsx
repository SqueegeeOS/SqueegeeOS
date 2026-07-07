"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <header>
        <p className="mb-1 text-[10px] uppercase tracking-widest text-[#555]">
          {mode === "tech" ? "Document visit" : "HQ · Document visit"}
        </p>
        <h1 className="font-serif text-2xl text-white">{propertyName}</h1>
        {propertyAddress ? (
          <p className="mt-1 text-sm text-[#666]">{propertyAddress}</p>
        ) : null}
      </header>

      <label className="block">
        <span className="mb-2 block text-[10px] uppercase tracking-widest text-[#555]">
          Your name
        </span>
        <input
          value={technicianName}
          onChange={(event) => setTechnicianName(event.target.value)}
          placeholder="Technician name"
          className="w-full rounded-xl border border-[#222] bg-[#111] px-4 py-3 text-sm text-white outline-none placeholder:text-[#444] focus:border-[#c9a96e44]"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-[10px] uppercase tracking-widest text-[#555]">
          Visit date
        </span>
        <input
          type="date"
          value={visitDate}
          onChange={(event) => setVisitDate(event.target.value)}
          className="w-full rounded-xl border border-[#222] bg-[#111] px-4 py-3 text-sm text-white outline-none focus:border-[#c9a96e44]"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-[10px] uppercase tracking-widest text-[#555]">
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
          className="w-full resize-none rounded-xl border border-[#222] bg-[#111] px-4 py-3 text-sm leading-relaxed text-white outline-none placeholder:text-[#444] focus:border-[#c9a96e44]"
        />
      </label>

      {mode === "founder" ? (
        <>
          <label className="block">
            <span className="mb-2 block text-[10px] uppercase tracking-widest text-[#555]">
              Customer-visible summary (optional)
            </span>
            <textarea
              value={customerSummary}
              onChange={(event) => setCustomerSummary(event.target.value)}
              placeholder="What the homeowner should see in their portal."
              rows={3}
              className="w-full resize-none rounded-xl border border-[#222] bg-[#111] px-4 py-3 text-sm leading-relaxed text-white outline-none placeholder:text-[#444] focus:border-[#c9a96e44]"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-[10px] uppercase tracking-widest text-[#555]">
              Internal note (optional)
            </span>
            <textarea
              value={internalNote}
              onChange={(event) => setInternalNote(event.target.value)}
              placeholder="Founder-only context. Never shown in the customer portal."
              rows={3}
              className="w-full resize-none rounded-xl border border-[#222] bg-[#111] px-4 py-3 text-sm leading-relaxed text-white outline-none placeholder:text-[#444] focus:border-[#c9a96e44]"
            />
          </label>
        </>
      ) : null}

      <label className="flex items-start gap-3 rounded-xl border border-[#222] bg-[#111] px-4 py-3">
        <input
          type="checkbox"
          checked={followUpNeeded}
          onChange={(event) => setFollowUpNeeded(event.target.checked)}
          className="mt-1"
        />
        <span>
          <span className="block text-sm text-white">Follow-up recommended</span>
          <span className="mt-0.5 block text-xs text-[#666]">
            Flags this visit for a future recommendation or callback.
          </span>
        </span>
      </label>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <button
        type="submit"
        disabled={saving}
        className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-[#c9a96e] px-6 text-base font-medium tracking-wide text-black transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save visit memory"}
      </button>

      <Link
        href={cancelHref}
        className="block text-center text-xs text-[#555] underline underline-offset-2 hover:text-[#c9a96e]"
      >
        Cancel
      </Link>
    </form>
  );
}
