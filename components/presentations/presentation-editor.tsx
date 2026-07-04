"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  getPresentationSlides,
  type PresentationData,
} from "@/lib/presentations/types";
import { withComputedRates } from "@/lib/presentations/calculations";

export function PresentationEditor({
  presentation: initial,
}: {
  presentation: PresentationData;
}) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof PresentationData>(
    field: K,
    value: PresentationData[K],
  ) => {
    setData((prev) => {
      const next = { ...prev, [field]: value };
      if (
        field === "tier" ||
        field === "homeSqft" ||
        field === "monthlyRate" ||
        field === "retailValue"
      ) {
        return { ...next, ...withComputedRates(next) };
      }
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/presentations/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const json = (await res.json()) as { presentation: PresentationData };
        setData(json.presentation);
      }
    } finally {
      setSaving(false);
    }
  };

  const present = async () => {
    await save();
    router.push(`/presentations/${data.id}/present`);
  };

  return (
    <div className="min-h-screen bg-[#060606] text-[#f5f2eb]">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-5 sm:px-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-accent/70">
            Presentation Editor
          </p>
          <h1 className="text-xl font-medium">{data.clientName}</h1>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded border border-white/15 px-5 py-2.5 text-sm"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={present}
            className="rounded bg-accent px-5 py-2.5 text-sm font-semibold text-[#060606]"
          >
            Present →
          </button>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-73px)] lg:grid-cols-[320px_1fr]">
        <aside className="border-b border-white/10 p-6 lg:border-b-0 lg:border-r">
          <p className="mb-5 text-[10px] uppercase tracking-[0.18em] text-white/30">
            Client details
          </p>

          {(
            [
              ["Client Name", "clientName", "text"],
              ["Address", "clientAddress", "text"],
              ["Email", "clientEmail", "email"],
              ["Home Sq Ft", "homeSqft", "number"],
              ["Per Visit Rate", "monthlyRate", "number"],
              ["Included Treatment Value", "retailValue", "number"],
            ] as const
          ).map(([label, field, type]) => (
            <label key={field} className="mb-5 block">
              <span className="mb-1.5 block text-[11px] text-white/40">
                {label}
              </span>
              <input
                type={type}
                value={String(data[field] ?? "")}
                onChange={(e) =>
                  update(
                    field,
                    (type === "number"
                      ? Number.parseFloat(e.target.value) || 0
                      : e.target.value) as PresentationData[typeof field],
                  )
                }
                className="w-full rounded border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-accent/40"
              />
            </label>
          ))}

          <label className="mb-5 block">
            <span className="mb-1.5 block text-[11px] text-white/40">Tier</span>
            <select
              value={data.tier}
              onChange={(e) =>
                update("tier", e.target.value as PresentationData["tier"])
              }
              className="w-full rounded border border-white/10 bg-white/5 px-3 py-2.5 text-sm"
            >
              <option value="biannual">Bi-Annual — Consistent Care</option>
              <option value="quarterly">Quarterly — Total Protection</option>
            </select>
          </label>

          <label className="mb-5 block">
            <span className="mb-1.5 block text-[11px] text-white/40">
              Custom notes (close slide)
            </span>
            <textarea
              value={data.customNotes}
              onChange={(e) => update("customNotes", e.target.value)}
              rows={4}
              className="w-full rounded border border-white/10 bg-white/5 px-3 py-2.5 text-sm"
            />
          </label>

          <div className="mt-6 rounded border border-accent/15 bg-accent/5 p-4 text-sm">
            <p className="mb-3 text-[10px] uppercase tracking-[0.16em] text-accent/70">
              Calculated
            </p>
            <div className="flex justify-between">
              <span className="text-white/40">Annual</span>
              <span>${data.annualRate.toFixed(0)}/yr</span>
            </div>
            <div className="mt-2 flex justify-between">
              <span className="text-white/40">Status</span>
              <span className="capitalize">{data.status}</span>
            </div>
          </div>
        </aside>

        <main className="p-6 sm:p-8">
          {(() => {
            const slides = getPresentationSlides(data);
            return (
              <>
          <p className="mb-5 text-[10px] uppercase tracking-[0.18em] text-white/30">
            Slides — {slides.length} total
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {slides.map((slide, index) => (
              <div
                key={slide.id}
                className="rounded border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="mb-2 flex justify-between text-[11px] text-accent/60">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {slide.editable.length > 0 && (
                    <span className="text-white/30">editable</span>
                  )}
                </div>
                <p className="font-medium">{slide.label}</p>
                <p className="mt-1 text-xs text-white/40">{slide.description}</p>
                {slide.editable.map((field) => (
                  <input
                    key={field}
                    placeholder={`Custom ${field}…`}
                    value={data.slideOverrides?.[slide.id]?.[field] ?? ""}
                    onChange={(e) =>
                      update("slideOverrides", {
                        ...data.slideOverrides,
                        [slide.id]: {
                          ...data.slideOverrides?.[slide.id],
                          [field]: e.target.value,
                        },
                      })
                    }
                    className="mt-2 w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-xs"
                  />
                ))}
              </div>
            ))}
          </div>
              </>
            );
          })()}
        </main>
      </div>
    </div>
  );
}
