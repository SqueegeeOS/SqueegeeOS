"use client";

import { useEffect, useState } from "react";
import {
  ensureOsLaunchedDate,
  formatBusinessDate,
  getInclusiveDayCount,
  getYearsBuilding,
} from "@/lib/admin/business-timeline";
import type { LegacyBaseline } from "@/lib/admin/legacy-baseline";

interface AdminBusinessHistoryProps {
  legacyBaseline: LegacyBaseline;
}

export function AdminBusinessHistory({ legacyBaseline }: AdminBusinessHistoryProps) {
  const [osLaunched, setOsLaunched] = useState<string | null>(null);
  const [daysOnOs, setDaysOnOs] = useState(1);

  useEffect(() => {
    const launched = ensureOsLaunchedDate();
    setOsLaunched(launched);
    setDaysOnOs(getInclusiveDayCount(launched));

    const interval = window.setInterval(() => {
      setDaysOnOs(getInclusiveDayCount(launched));
    }, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  if (!osLaunched) return null;

  const legacyYears =
    legacyBaseline.onboardingComplete && legacyBaseline.companyFoundedDate
      ? getYearsBuilding(legacyBaseline.companyFoundedDate)
      : null;

  return (
    <article className="rounded-[1.75rem] border border-border/80 bg-background/30 p-6 sm:p-7">
      <div className="space-y-6">
        <section>
          <p className="text-[10px] uppercase tracking-[0.28em] text-muted">
            Legacy
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted/85">
            The company Noah already built.
          </p>
          {legacyBaseline.companyFoundedDate && legacyYears !== null ? (
            <dl className="mt-4 space-y-3">
              <div>
                <dt className="text-[10px] uppercase tracking-[0.2em] text-muted">
                  Company Founded
                </dt>
                <dd className="mt-1 font-serif text-lg font-light text-foreground">
                  {formatBusinessDate(legacyBaseline.companyFoundedDate)}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.2em] text-muted">
                  Years Building SqueegeeKing
                </dt>
                <dd className="mt-1 font-serif text-3xl font-light text-foreground">
                  {legacyYears}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-sm text-muted">
              Record your legacy baseline to honor pre-OS history.
            </p>
          )}
        </section>

        <section className="border-t border-border/60 pt-6">
          <p className="text-[10px] uppercase tracking-[0.28em] text-accent">
            Operating System
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted/85">
            History created since launching SqueegeeKing OS.
          </p>
          <dl className="mt-4 space-y-3">
            <div>
              <dt className="text-[10px] uppercase tracking-[0.2em] text-muted">
                OS Launched
              </dt>
              <dd className="mt-1 font-serif text-lg font-light text-foreground">
                {formatBusinessDate(osLaunched)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.2em] text-muted">
                Days on SqueegeeKing OS
              </dt>
              <dd className="mt-1 font-serif text-3xl font-light text-accent">
                {daysOnOs}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </article>
  );
}
