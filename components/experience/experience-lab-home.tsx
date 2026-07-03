"use client";

import Link from "next/link";
import { EXPERIENCE_LAB_ITEMS } from "@/lib/experience/lab-config";

export function ExperienceLabHome() {
  return (
    <div className="relative min-h-[100svh] overflow-x-hidden bg-background pb-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,184,150,0.08),transparent_55%)]" />
      <div className="relative mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-[10px] uppercase tracking-[0.32em] text-accent">
          Experience Lab
        </p>
        <h1 className="mt-4 font-serif text-4xl font-light text-foreground sm:text-5xl">
          Signature animations
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted">
          Preview production ceremonies and transitions without checkout, request
          flows, or database writes. Demo data only.
        </p>

        <div className="mt-12 grid gap-5 sm:grid-cols-1">
          {EXPERIENCE_LAB_ITEMS.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="group rounded-[1.75rem] border border-border/80 bg-surface/45 p-6 transition-colors hover:border-accent/25 sm:p-8"
            >
              <p className="text-[10px] uppercase tracking-[0.24em] text-muted">
                {item.timings.join(" · ")}
              </p>
              <h2 className="mt-3 font-serif text-2xl font-light text-foreground group-hover:text-accent">
                {item.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {item.description}
              </p>
              <p className="mt-5 text-[10px] uppercase tracking-[0.2em] text-accent">
                Open preview →
              </p>
            </Link>
          ))}
        </div>

        <p className="mt-12 text-xs leading-relaxed text-muted/70">
          Hidden from public navigation. Protected by the same Headquarters PIN.
          Not indexed by search engines.
        </p>
      </div>
    </div>
  );
}
