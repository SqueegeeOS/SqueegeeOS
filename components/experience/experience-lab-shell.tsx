"use client";

import Link from "next/link";
import { EXPERIENCE_ROUTES } from "@/lib/experience/lab-config";

interface ExperienceLabShellProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export function ExperienceLabShell({
  title,
  description,
  children,
}: ExperienceLabShellProps) {
  return (
    <div className="relative min-h-[100svh] overflow-x-hidden bg-background pb-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,184,150,0.07),transparent_55%)]" />
      <div className="relative mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <Link
          href={EXPERIENCE_ROUTES.home}
          className="text-[10px] uppercase tracking-[0.22em] text-muted transition-colors hover:text-accent"
        >
          ← Experience Lab
        </Link>
        <p className="mt-8 text-[10px] uppercase tracking-[0.32em] text-accent">
          Internal · Creative testing only
        </p>
        <h1 className="mt-4 font-serif text-3xl font-light text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          {description}
        </p>
        <div className="mt-10">{children}</div>
      </div>
    </div>
  );
}
