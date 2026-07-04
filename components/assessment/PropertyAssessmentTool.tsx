"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AssessmentAreaCard } from "@/components/assessment/AssessmentAreaCard";
import { AssessmentModeSelector } from "@/components/assessment/AssessmentModeSelector";
import { AssessmentSummaryBar } from "@/components/assessment/AssessmentSummaryBar";
import { AddAreaSheet } from "@/components/assessment/AddAreaSheet";
import { ProposalSection } from "@/components/assessment/ProposalSection";
import {
  CARE_PACKAGE_AREA_KEYS,
  getAreaDefinition,
  WINDOW_AREA_KEYS,
  type AssessmentAreaKey,
} from "@/lib/health/assessment-areas";
import {
  calculateAssessmentOverallScore,
  type AssessmentFormState,
  type AssessmentType,
  type ScoreValue,
} from "@/lib/health/assessment-types";

const TECHNICIAN_NAME_KEY = "squeegeeos-tech-name";

function createInitialState(
  propertyId: string,
  visitId: string | undefined,
  mode: AssessmentType,
  technicianName: string,
): AssessmentFormState {
  const activeAreas: AssessmentAreaKey[] =
    mode === "window_service"
      ? [...WINDOW_AREA_KEYS]
      : mode === "care_package"
        ? [...CARE_PACKAGE_AREA_KEYS]
        : [...WINDOW_AREA_KEYS];

  return {
    propertyId,
    visitId,
    technicianName,
    visitDate: new Date().toISOString().split("T")[0]!,
    assessmentType: mode,
    activeAreas,
    scores: {},
    naAreas: [],
    internalNote: "",
    customerNote: "",
    customerNoteVisible: false,
    proposalSummary: "",
    recommendedServices: [],
  };
}

function AssessmentNoteArea({
  label,
  badge,
  badgeActive,
  placeholder,
  value,
  onChange,
  footer,
}: {
  label: string;
  badge: string;
  badgeActive: boolean;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-[#111] px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-[#bbb]">{label}</span>
        <span
          className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest"
          style={{
            color: badgeActive ? "#c9a96e" : "#555",
            borderColor: badgeActive ? "#c9a96e44" : "#2a2a2a",
          }}
        >
          {badge}
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full resize-none bg-transparent text-sm text-[#aaa] outline-none placeholder:text-[#2a2a2a]"
      />
      {footer}
    </div>
  );
}

interface PropertyAssessmentToolProps {
  propertyId: string;
  propertyName: string;
  propertyAddress?: string;
  cancelHref: string;
}

export function PropertyAssessmentTool({
  propertyId,
  propertyName,
  propertyAddress,
  cancelHref,
}: PropertyAssessmentToolProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const visitId = searchParams.get("visitId") ?? undefined;
  const initialModeParam = searchParams.get("mode") as AssessmentType | null;

  const [technicianName, setTechnicianName] = useState("");
  const [mode, setMode] = useState<AssessmentType | null>(
    initialModeParam &&
      ["window_service", "care_package", "custom"].includes(initialModeParam)
      ? initialModeParam
      : null,
  );
  const [form, setForm] = useState<AssessmentFormState | null>(null);
  const [addSheet, setAddSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(TECHNICIAN_NAME_KEY);
    if (stored) setTechnicianName(stored);
  }, []);

  useEffect(() => {
    if (mode && !form) {
      setForm(createInitialState(propertyId, visitId, mode, technicianName));
    }
  }, [mode, form, propertyId, visitId, technicianName]);

  useEffect(() => {
    if (form && technicianName && !form.technicianName) {
      setForm((prev) =>
        prev ? { ...prev, technicianName } : prev,
      );
    }
  }, [form, technicianName]);

  const handleModeSelect = (selected: AssessmentType) => {
    setMode(selected);
    setForm(
      createInitialState(propertyId, visitId, selected, technicianName),
    );
  };

  const setScore = useCallback((key: AssessmentAreaKey, value: ScoreValue) => {
    setForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        scores: { ...prev.scores, [key]: value },
        naAreas:
          value !== null
            ? prev.naAreas.filter((k) => k !== key)
            : prev.naAreas,
      };
    });
  }, []);

  const toggleNA = useCallback((key: AssessmentAreaKey) => {
    setForm((prev) => {
      if (!prev) return prev;
      const isNA = prev.naAreas.includes(key);
      return {
        ...prev,
        naAreas: isNA
          ? prev.naAreas.filter((k) => k !== key)
          : [...prev.naAreas, key],
        scores: isNA ? prev.scores : { ...prev.scores, [key]: null },
      };
    });
  }, []);

  const addArea = useCallback((key: AssessmentAreaKey) => {
    setForm((prev) => {
      if (!prev || prev.activeAreas.includes(key)) return prev;
      return { ...prev, activeAreas: [...prev.activeAreas, key] };
    });
    setAddSheet(false);
  }, []);

  const removeArea = useCallback(
    (key: AssessmentAreaKey) => {
      if (WINDOW_AREA_KEYS.includes(key) && mode === "window_service") return;
      setForm((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          activeAreas: prev.activeAreas.filter((k) => k !== key),
          naAreas: prev.naAreas.filter((k) => k !== key),
        };
      });
    },
    [mode],
  );

  const handleSubmit = async () => {
    if (!form) return;
    if (!form.technicianName.trim()) {
      setError("Enter your name before saving.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        throw new Error(payload.error ?? "Save failed");
      }

      const payload = (await res.json()) as { id: string };
      window.localStorage.setItem(TECHNICIAN_NAME_KEY, form.technicianName.trim());
      setSaved(true);

      setTimeout(() => {
        if (form.assessmentType === "care_package") {
          router.push(
            `/tech/proposal-preview?propertyId=${propertyId}&assessmentId=${payload.id}`,
          );
        } else {
          router.push(cancelHref);
        }
      }, 1600);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
      setSaving(false);
    }
  };

  const overallScore = form
    ? calculateAssessmentOverallScore(
        form.scores,
        form.activeAreas,
        form.naAreas,
      )
    : null;

  const scoredCount = form
    ? form.activeAreas.filter(
        (k) => !form.naAreas.includes(k) && form.scores[k] != null,
      ).length
    : 0;

  const scoreableTotal = form
    ? form.activeAreas.length - form.naAreas.length
    : 0;

  const isCarePackage = mode === "care_package";

  if (saved) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 text-5xl">✦</div>
        <h2 className="mb-2 font-serif text-2xl text-white">
          {isCarePackage ? "Assessment Saved" : "Health Check Saved"}
        </h2>
        {overallScore !== null && (
          <p className="mb-1 text-xl text-[#c9a96e]">{overallScore}% overall</p>
        )}
        {isCarePackage && (
          <p className="mt-2 text-sm text-[#444]">Opening proposal preview...</p>
        )}
      </div>
    );
  }

  if (!mode || !form) {
    return <AssessmentModeSelector onSelect={handleModeSelect} />;
  }

  return (
    <div className="pb-32">
      <div className="mb-6">
        <button
          type="button"
          onClick={() => {
            setMode(null);
            setForm(null);
          }}
          className="mb-3 flex items-center gap-1 text-[10px] uppercase tracking-widest text-[#444]"
        >
          ← Change mode
        </button>
        <Link
          href={cancelHref}
          className="mb-3 block text-[10px] uppercase tracking-widest text-[#333] hover:text-[#666]"
        >
          ← Back to {propertyName}
        </Link>
        <p className="mb-1 text-[10px] uppercase tracking-widest text-[#555]">
          {isCarePackage ? "Care Package Assessment" : "Property Health Check"}
        </p>
        <h1 className="font-serif text-2xl text-white">
          {isCarePackage ? "Full Property Assessment" : "Window Health Check"}
        </h1>
        {propertyAddress && (
          <p className="mt-1 text-sm text-[#666]">{propertyAddress}</p>
        )}
      </div>

      <label className="mb-4 block rounded-xl bg-[#111] px-4 py-3">
        <span className="text-sm font-medium text-[#bbb]">Technician</span>
        <input
          type="text"
          value={form.technicianName}
          onChange={(e) => {
            setTechnicianName(e.target.value);
            setForm((p) =>
              p ? { ...p, technicianName: e.target.value } : p,
            );
          }}
          placeholder="Your name"
          className="mt-2 w-full bg-transparent text-sm text-white outline-none placeholder:text-[#333]"
        />
      </label>

      <AssessmentSummaryBar
        score={overallScore}
        scoredCount={scoredCount}
        totalCount={scoreableTotal}
      />

      <div className="mb-4 space-y-2">
        {form.activeAreas.map((key) => {
          const def = getAreaDefinition(key);
          if (!def) return null;
          return (
            <AssessmentAreaCard
              key={key}
              definition={def}
              score={form.scores[key] ?? null}
              isNA={form.naAreas.includes(key)}
              allowNA={def.allowNA || isCarePackage || mode === "custom"}
              removable={
                !WINDOW_AREA_KEYS.includes(key) || mode !== "window_service"
              }
              onScore={(v) => setScore(key, v)}
              onToggleNA={() => toggleNA(key)}
              onRemove={() => removeArea(key)}
            />
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setAddSheet(true)}
        className="mb-6 w-full rounded-xl border border-dashed border-[#2a2a2a] py-3 text-sm text-[#444] transition-colors hover:border-[#c9a96e] hover:text-[#c9a96e] active:scale-[0.98]"
      >
        + Add Assessment Area
      </button>

      {isCarePackage && (
        <ProposalSection
          summary={form.proposalSummary}
          services={form.recommendedServices}
          onSummaryChange={(v) =>
            setForm((p) => (p ? { ...p, proposalSummary: v } : p))
          }
          onServicesChange={(v) =>
            setForm((p) => (p ? { ...p, recommendedServices: v } : p))
          }
        />
      )}

      <div className="mb-6 space-y-3">
        <AssessmentNoteArea
          label="Internal Note"
          badge="Internal only"
          badgeActive={false}
          placeholder="Gate code, dog schedule, access notes..."
          value={form.internalNote}
          onChange={(v) =>
            setForm((p) => (p ? { ...p, internalNote: v } : p))
          }
        />
        <AssessmentNoteArea
          label="Customer Care Note"
          badge={
            form.customerNoteVisible ? "Visible in portal" : "Hidden from customer"
          }
          badgeActive={form.customerNoteVisible}
          placeholder="Your home is in great shape overall..."
          value={form.customerNote}
          onChange={(v) =>
            setForm((p) => (p ? { ...p, customerNote: v } : p))
          }
          footer={
            <button
              type="button"
              onClick={() =>
                setForm((p) =>
                  p
                    ? { ...p, customerNoteVisible: !p.customerNoteVisible }
                    : p,
                )
              }
              className="mt-2 text-xs text-[#555] underline underline-offset-2 active:text-[#c9a96e]"
            >
              {form.customerNoteVisible
                ? "Hide from customer"
                : "Make visible to customer"}
            </button>
          }
        />
      </div>

      {error && (
        <p className="mb-4 text-center text-sm text-red-400">{error}</p>
      )}

      <div className="fixed bottom-0 left-0 right-0 mx-auto max-w-lg bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-transparent px-4 pb-6 pt-4">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || scoredCount === 0}
          className="w-full rounded-xl bg-[#c9a96e] py-4 text-base font-medium tracking-wide text-black transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"
        >
          {saving
            ? "Saving..."
            : isCarePackage
              ? "Save Assessment + Open Proposal"
              : "Save Health Check"}
        </button>
        <p className="mt-2 text-center text-xs text-[#333]">
          {scoredCount} of {scoreableTotal} areas scored
        </p>
      </div>

      {addSheet && (
        <AddAreaSheet
          currentAreas={form.activeAreas}
          onAdd={addArea}
          onClose={() => setAddSheet(false)}
        />
      )}
    </div>
  );
}
