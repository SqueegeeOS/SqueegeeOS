"use client";

import type { ReactNode } from "react";

interface NoteFieldProps {
  label: string;
  badge: string;
  badgeColor: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  footer?: ReactNode;
}

export function NoteField({
  label,
  badge,
  badgeColor,
  placeholder,
  value,
  onChange,
  footer,
}: NoteFieldProps) {
  return (
    <div className="rounded-xl bg-[#111] px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-[#bbb]">{label}</span>
        <span
          className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest transition-colors duration-200"
          style={{
            color: badgeColor,
            borderColor: `${badgeColor}44`,
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
        className="w-full resize-none bg-transparent text-sm leading-relaxed text-[#aaa] outline-none placeholder:text-[#333]"
      />

      {footer}
    </div>
  );
}
