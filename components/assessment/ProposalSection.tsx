"use client";

import { useState } from "react";
import type { RecommendedService } from "@/lib/health/assessment-types";

const PRIORITY_COLORS = {
  high: "#ef4444",
  medium: "#f97316",
  low: "#84cc16",
};

interface ProposalSectionProps {
  summary: string;
  services: RecommendedService[];
  onSummaryChange: (value: string) => void;
  onServicesChange: (services: RecommendedService[]) => void;
}

export function ProposalSection({
  summary,
  services,
  onSummaryChange,
  onServicesChange,
}: ProposalSectionProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    service: "",
    priority: "medium" as "high" | "medium" | "low",
    note: "",
  });

  const addService = () => {
    if (!draft.service.trim()) return;
    onServicesChange([
      ...services,
      {
        id: crypto.randomUUID(),
        service: draft.service.trim(),
        priority: draft.priority,
        note: draft.note.trim(),
      },
    ]);
    setDraft({ service: "", priority: "medium", note: "" });
    setAdding(false);
  };

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-px flex-1 bg-[#1a1a1a]" />
        <p className="text-[10px] uppercase tracking-widest text-[#c9a96e]">
          Proposal
        </p>
        <div className="h-px flex-1 bg-[#1a1a1a]" />
      </div>

      <div className="mb-3 rounded-xl bg-[#111] px-4 py-3">
        <p className="mb-2 text-[10px] uppercase tracking-widest text-[#444]">
          Proposal Summary
        </p>
        <textarea
          value={summary}
          onChange={(e) => onSummaryChange(e.target.value)}
          placeholder="Describe overall property condition and recommended services..."
          rows={4}
          className="w-full resize-none bg-transparent text-sm text-[#aaa] outline-none placeholder:text-[#2a2a2a]"
        />
      </div>

      <div className="rounded-xl bg-[#111] px-4 py-3">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest text-[#444]">
            Recommended Services
          </p>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-lg border border-[#c9a96e33] px-2 py-1 text-[10px] text-[#c9a96e]"
          >
            + Add
          </button>
        </div>

        {services.length > 0 && (
          <div className="mb-3 space-y-2">
            {services.map((s) => (
              <div
                key={s.id}
                className="flex items-start gap-2 rounded-lg bg-[#0d0d0d] px-3 py-2.5"
              >
                <span
                  className="mt-0.5 shrink-0 text-[10px] font-medium uppercase tracking-wide"
                  style={{ color: PRIORITY_COLORS[s.priority] }}
                >
                  {s.priority}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-[#ccc]">{s.service}</p>
                  {s.note && (
                    <p className="mt-0.5 text-[10px] text-[#444]">{s.note}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onServicesChange(services.filter((x) => x.id !== s.id))
                  }
                  className="shrink-0 text-xs text-[#2a2a2a] hover:text-[#666]"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {services.length === 0 && !adding && (
          <p className="py-2 text-[10px] text-[#2a2a2a]">No services added yet.</p>
        )}

        {adding && (
          <div className="space-y-2 rounded-lg bg-[#0d0d0d] px-3 py-3">
            <input
              type="text"
              placeholder="Service name..."
              value={draft.service}
              onChange={(e) =>
                setDraft((p) => ({ ...p, service: e.target.value }))
              }
              className="w-full bg-transparent text-sm text-[#ccc] outline-none placeholder:text-[#333]"
            />
            <div className="flex gap-2">
              {(["high", "medium", "low"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, priority: p }))}
                  className="flex-1 rounded-lg py-1.5 text-[10px] uppercase tracking-wide"
                  style={{
                    backgroundColor:
                      draft.priority === p
                        ? `${PRIORITY_COLORS[p]}22`
                        : "#141414",
                    color: draft.priority === p ? PRIORITY_COLORS[p] : "#444",
                    border: `1px solid ${
                      draft.priority === p
                        ? `${PRIORITY_COLORS[p]}44`
                        : "#1e1e1e"
                    }`,
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Optional note..."
              value={draft.note}
              onChange={(e) => setDraft((p) => ({ ...p, note: e.target.value }))}
              className="w-full bg-transparent text-xs text-[#888] outline-none placeholder:text-[#2a2a2a]"
            />
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={addService}
                className="flex-1 rounded-lg bg-[#c9a96e] py-2 text-xs font-medium text-black"
              >
                Add Service
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="flex-1 rounded-lg bg-[#1a1a1a] py-2 text-xs text-[#444]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
