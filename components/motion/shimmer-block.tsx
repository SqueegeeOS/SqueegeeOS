"use client";

import type { ReactNode } from "react";

export function ShimmerBlock({
  className = "",
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`motion-shimmer relative overflow-hidden rounded-[inherit] bg-surface/60 ${className}`}
      aria-hidden={!children}
    >
      {children}
    </div>
  );
}

export function HeadquartersLoadingShell() {
  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-background">
      <div className="motion-grain pointer-events-none absolute inset-0 opacity-[0.035]" />
      <div className="relative mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
        <ShimmerBlock className="h-4 w-40 rounded-full" />
        <ShimmerBlock className="mt-6 h-14 w-2/3 max-w-xl rounded-2xl" />
        <ShimmerBlock className="mt-4 h-5 w-full max-w-lg rounded-full" />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <ShimmerBlock className="h-36 rounded-[1.75rem]" />
          <ShimmerBlock className="h-36 rounded-[1.75rem]" />
          <ShimmerBlock className="h-36 rounded-[1.75rem]" />
        </div>
        <ShimmerBlock className="mt-8 h-64 rounded-[2rem]" />
      </div>
      <p className="sr-only">Opening headquarters…</p>
    </div>
  );
}
