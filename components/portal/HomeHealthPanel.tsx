import Link from "next/link";
import { PortalCareNotes } from "@/components/portal/PortalCareNotes";
import { PortalScoreCard } from "@/components/portal/PortalScoreCard";
import { craftEyebrow, craftEyebrowAccent } from "@/lib/craft/tokens";
import type { CustomerHealthNote, CustomerHealthView } from "@/lib/health/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

interface HomeHealthPanelProps {
  latest: CustomerHealthView | null;
  notes: CustomerHealthNote[];
  propertyLabel?: string;
  backHref?: string;
}

export function HomeHealthPanel({
  latest,
  notes,
  propertyLabel,
  backHref,
}: HomeHealthPanelProps) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:px-10">
      {backHref && (
        <Link
          href={backHref}
          className="mb-6 inline-block text-[10px] uppercase tracking-[0.2em] text-muted hover:text-accent"
        >
          ← Back to portal
        </Link>
      )}

      <header className="mb-8">
        <p className={craftEyebrowAccent}>
          Your Home
        </p>
        <h1 className="mt-2 font-serif text-3xl font-light text-foreground sm:text-4xl">
          Home Health
        </h1>
        {propertyLabel && (
          <p className="mt-1 text-sm text-muted">{propertyLabel}</p>
        )}
        {latest && (
          <p className="mt-2 text-sm text-muted">
            Last visit: {formatDate(latest.visitDate)}
          </p>
        )}
      </header>

      {latest ? (
        <>
          <section className="mb-4 rounded-[1.35rem] border border-border/80 bg-surface/50 px-6 py-6">
            <p className={craftEyebrow}>
              Overall Care Score
            </p>
            <p className="mt-2 font-serif text-5xl font-light text-accent sm:text-6xl">
              {latest.overallScore ?? "—"}
              {latest.overallScore != null && (
                <span className="text-3xl text-muted">%</span>
              )}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Based on the most recent technician health check.
            </p>

            {latest.overallScore != null && (
              <div className="mt-4 h-[2px] overflow-hidden rounded-full bg-border/60">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-700"
                  style={{ width: `${latest.overallScore}%` }}
                />
              </div>
            )}
          </section>

          <div className="mb-4 grid grid-cols-3 gap-3">
            <PortalScoreCard
              label="Windows"
              score={latest.windowHealth}
              themed
            />
            <PortalScoreCard
              label="Screens"
              score={latest.screenHealth}
              themed
            />
            <PortalScoreCard
              label="Hard Water"
              score={latest.hardWaterRisk}
              invertColor
              themed
            />
          </div>

          {notes.length > 0 && <PortalCareNotes notes={notes} themed />}
        </>
      ) : (
        <section className="rounded-[1.35rem] border border-border/80 bg-surface/50 px-6 py-12 text-center">
          <p className="text-sm leading-relaxed text-muted">
            Your home health summary will appear here after your first visit.
          </p>
        </section>
      )}
    </div>
  );
}
