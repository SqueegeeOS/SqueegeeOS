import type { ReactNode } from "react";
import Link from "next/link";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { GlassCard } from "@/components/craft/glass-card";
import { craftBody, craftEyebrowAccent, craftHeading } from "@/lib/craft/tokens";

export function AccessFrame({
  eyebrow,
  badge,
  title,
  detail,
  children,
  returnLabel = "Founder sign-in",
  returnHref = "/hq",
}: {
  eyebrow: string;
  badge?: string;
  title: string;
  detail: string;
  children: ReactNode;
  returnLabel?: string;
  returnHref?: string;
}) {
  return (
    <AmbientStage
      founding
      className="atlas-role-shell min-h-[100svh] px-4 py-10 sm:px-6"
    >
      <main className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-lg items-center">
        <GlassCard tone="elevated" padding="lg" rim className="sm:!p-9">
          <div className="flex items-start justify-between gap-4">
            <p className={craftEyebrowAccent}>{eyebrow}</p>
            {badge ? (
              <span className="shrink-0 rounded-full border border-accent/20 bg-accent/[0.08] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-accent">
                {badge}
              </span>
            ) : null}
          </div>
          <h1 className={`mt-5 text-4xl sm:text-5xl ${craftHeading}`}>
            {title}
          </h1>
          <p className={`mt-4 ${craftBody}`}>{detail}</p>

          {children}

          <Link
            href={returnHref}
            className="mt-6 inline-flex min-h-11 items-center text-xs text-foreground/52 transition-colors duration-[var(--motion-standard)] hover:text-accent"
          >
            {returnLabel} <span aria-hidden className="ml-1">→</span>
          </Link>
        </GlassCard>
      </main>
    </AmbientStage>
  );
}
