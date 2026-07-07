"use client";

import type { ReactNode } from "react";

interface PortalStageProps {
  children: ReactNode;
  founding?: boolean;
}

/** Lit-stage environment — presentation continuity for the member portal. */
export function PortalStage({ children, founding = false }: PortalStageProps) {
  return (
    <div className="relative min-h-[100svh] overflow-x-hidden bg-[#060606] text-[#f5f2eb]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -12%, rgba(201,184,150,0.07), transparent 65%)",
        }}
        aria-hidden
      />
      {founding && (
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.1),transparent_68%)]"
          aria-hidden
        />
      )}
      <div
        className="motion-grain pointer-events-none absolute inset-0 opacity-[0.03]"
        aria-hidden
      />
      <div className="relative">{children}</div>
    </div>
  );
}
