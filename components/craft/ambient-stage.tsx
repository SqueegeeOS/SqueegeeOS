"use client";

import type { ReactNode } from "react";

interface AmbientStageProps {
  children: ReactNode;
  className?: string;
  founding?: boolean;
  warm?: boolean;
}

export function AmbientStage({
  children,
  className = "",
  founding = false,
  warm = true,
}: AmbientStageProps) {
  return (
    <div
      className={`craft-stage relative min-h-[100svh] overflow-x-hidden text-foreground ${className}`}
    >
      {warm ? (
        <div className="craft-stage-warmth pointer-events-none absolute inset-0" aria-hidden />
      ) : null}
      {founding ? (
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.09),transparent_68%)]"
          aria-hidden
        />
      ) : null}
      <div
        className="motion-grain pointer-events-none absolute inset-0 opacity-[0.028]"
        aria-hidden
      />
      <div className="relative">{children}</div>
    </div>
  );
}
