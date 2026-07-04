import type { ReactNode } from "react";

export function GlassCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.24)] backdrop-blur-md transition-colors hover:border-accent/20 hover:bg-white/[0.06] ${className}`}
    >
      {children}
    </div>
  );
}
