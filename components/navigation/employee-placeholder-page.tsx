"use client";

import Link from "next/link";
import { AmbientGlow, Eyebrow, PageLead, PageTitle, Reveal } from "@/components/property/ui/primitives";

interface EmployeePlaceholderPageProps {
  eyebrow: string;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}

export function EmployeePlaceholderPage({
  eyebrow,
  title,
  description,
  actionHref,
  actionLabel,
}: EmployeePlaceholderPageProps) {
  return (
    <div
      className="relative min-h-screen overflow-x-hidden bg-background"
      style={{ paddingTop: "var(--site-chrome-offset)" }}
    >
      <AmbientGlow />

      <div className="relative mx-auto max-w-3xl px-5 py-16 sm:px-10 sm:py-24">
        <Reveal>
          <Eyebrow>{eyebrow}</Eyebrow>
          <PageTitle className="mt-5">{title}</PageTitle>
          <PageLead className="mt-6">{description}</PageLead>

          {actionHref && actionLabel && (
            <Link
              href={actionHref}
              className="mt-10 inline-flex min-h-[52px] items-center justify-center rounded-full border border-accent/30 px-8 text-sm tracking-[0.12em] text-accent transition-colors hover:bg-accent/10"
            >
              {actionLabel}
            </Link>
          )}
        </Reveal>
      </div>
    </div>
  );
}
