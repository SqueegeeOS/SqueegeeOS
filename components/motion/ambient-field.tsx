"use client";

import type { ReactNode } from "react";

/** Static environment — no mouse tracking, no breathing loops. */
export function AmbientField({
  variant = "default",
}: {
  variant?: "default" | "minimal";
}) {
  if (variant === "minimal") {
    return (
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,rgba(201,184,150,0.06),transparent_58%)]"
      />
    );
  }

  return (
    <>
      <div
        aria-hidden
        className="motion-grain pointer-events-none fixed inset-0 z-0 opacity-[0.022]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,rgba(201,184,150,0.065),transparent_58%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_bottom,rgba(0,0,0,0.28),transparent_70%)]"
      />
    </>
  );
}

export function AmbientFieldScoped({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: "default" | "minimal";
}) {
  return (
    <div className="relative isolate min-h-[100svh] overflow-x-hidden">
      <AmbientField variant={variant} />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
