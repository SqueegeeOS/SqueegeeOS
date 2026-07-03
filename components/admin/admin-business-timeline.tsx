"use client";

import { useEffect, useState } from "react";
import {
  ensureBusinessStartedDate,
  formatBusinessStartedDate,
  getDaysBuilding,
} from "@/lib/admin/business-timeline";

export function AdminBusinessTimeline() {
  const [businessStarted, setBusinessStarted] = useState<string | null>(null);
  const [daysBuilding, setDaysBuilding] = useState(1);

  useEffect(() => {
    const started = ensureBusinessStartedDate();
    setBusinessStarted(started);
    setDaysBuilding(getDaysBuilding(started));

    const interval = window.setInterval(() => {
      setDaysBuilding(getDaysBuilding(started));
    }, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  if (!businessStarted) return null;

  return (
    <article className="rounded-[1.75rem] border border-border/80 bg-background/30 p-6 sm:p-7">
      <dl className="space-y-5">
        <div>
          <dt className="text-[10px] uppercase tracking-[0.24em] text-muted">
            Business Started
          </dt>
          <dd className="mt-2 font-serif text-xl font-light text-foreground">
            {formatBusinessStartedDate(businessStarted)}
          </dd>
        </div>
        <div className="border-t border-border/60 pt-5">
          <dt className="text-[10px] uppercase tracking-[0.24em] text-muted">
            Days Building SqueegeeKing
          </dt>
          <dd className="mt-2 font-serif text-4xl font-light text-accent">
            {daysBuilding}
          </dd>
        </div>
      </dl>
    </article>
  );
}
