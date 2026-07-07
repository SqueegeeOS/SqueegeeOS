"use client";

import { useId, useState, type ReactNode } from "react";
import type { SlideOverride, SlideType } from "@/lib/presentations/types";
import {
  SQUEEGEEKING_TIERS,
  type SqueegeeKingTierId,
} from "@/lib/membership/tier-config";

export function EditorField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] text-[#888]">{label}</span>
      {children}
      {hint ? (
        <span className="mt-1.5 block text-[10px] leading-relaxed text-[#444]">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function EditorTextInput({
  value,
  onChange,
  type = "text",
  placeholder,
  inputMode,
}: {
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "number";
  placeholder?: string;
  inputMode?: "text" | "email" | "numeric" | "decimal";
}) {
  return (
    <input
      type={type}
      inputMode={inputMode}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-[#222] bg-[#111] px-3.5 py-3 text-sm text-[#ddd] outline-none placeholder:text-[#333] focus:border-[#c9a96e]/50"
    />
  );
}

export function EditorTextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      placeholder={placeholder}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      className="w-full resize-none rounded-xl border border-[#222] bg-[#111] px-3.5 py-3 text-sm text-[#ddd] outline-none placeholder:text-[#333] focus:border-[#c9a96e]/50"
    />
  );
}

export function CollapsibleSection({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section className="overflow-hidden rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors active:bg-[#111]"
      >
        <span
          className="text-[10px] text-[#555] transition-transform duration-200"
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
          aria-hidden
        >
          ▸
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-[#ccc]">{title}</span>
          {!open && summary ? (
            <span className="mt-0.5 block truncate text-[11px] text-[#444]">
              {summary}
            </span>
          ) : null}
        </span>
      </button>
      {open ? (
        <div
          id={panelId}
          className="space-y-4 border-t border-[#1a1a1a] px-4 pb-4 pt-3"
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}

export function TierPicker({
  value,
  onChange,
}: {
  value: SqueegeeKingTierId;
  onChange: (tier: SqueegeeKingTierId) => void;
}) {
  const tiers = Object.values(SQUEEGEEKING_TIERS);

  return (
    <div className="grid gap-2">
      {tiers.map((tier) => {
        const selected = value === tier.id;
        return (
          <button
            key={tier.id}
            type="button"
            onClick={() => onChange(tier.id)}
            className="rounded-xl border px-4 py-3.5 text-left transition-all active:scale-[0.99]"
            style={{
              borderColor: selected ? "#c9a96e55" : "#222",
              backgroundColor: selected ? "#141008" : "#111",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p
                  className="text-sm font-medium"
                  style={{ color: selected ? "#c9a96e" : "#ccc" }}
                >
                  {tier.label}
                </p>
                <p className="mt-0.5 text-[11px] text-[#555]">{tier.tagline}</p>
                <p className="mt-1 text-[10px] text-[#444]">{tier.frequency}</p>
              </div>
              {selected ? (
                <span className="text-[10px] uppercase tracking-widest text-[#c9a96e]">
                  Selected
                </span>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function SlideOverrideAccordion({
  slides,
  overrides,
  onOverride,
}: {
  slides: Array<{
    id: SlideType;
    label: string;
    description: string;
    editable: Array<keyof SlideOverride>;
  }>;
  overrides: Partial<Record<SlideType, SlideOverride>>;
  onOverride: (
    slideId: SlideType,
    field: keyof SlideOverride,
    value: string,
  ) => void;
}) {
  if (slides.length === 0) {
    return (
      <p className="text-xs text-[#444]">No editable slides in this deck.</p>
    );
  }

  return (
    <div className="space-y-2">
      {slides.map((slide) => (
        <CollapsibleSection
          key={slide.id}
          title={slide.label}
          summary={slide.description}
        >
          {slide.editable.map((field) => (
            <EditorField
              key={field}
              label={field === "highlight" ? "Highlight" : field}
            >
              {field === "body" ? (
                <EditorTextArea
                  value={overrides[slide.id]?.[field] ?? ""}
                  placeholder={`Optional ${field}…`}
                  rows={3}
                  onChange={(v) => onOverride(slide.id, field, v)}
                />
              ) : (
                <EditorTextInput
                  value={overrides[slide.id]?.[field] ?? ""}
                  placeholder={`Optional ${field}…`}
                  onChange={(v) => onOverride(slide.id, field, v)}
                />
              )}
            </EditorField>
          ))}
        </CollapsibleSection>
      ))}
    </div>
  );
}
