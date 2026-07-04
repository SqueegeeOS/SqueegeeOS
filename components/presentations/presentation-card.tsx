"use client";

import Link from "next/link";
import type { PresentationData } from "@/lib/presentations/types";
import { tierLabel } from "@/lib/presentations/types";
import { formatTierPrice } from "@/lib/membership/tier-config";

export function PresentationCard({
  presentation,
}: {
  presentation: PresentationData;
}) {
  return (
    <Link
      href={`/presentations/${presentation.id}/edit`}
      className="block rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-accent/30"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-serif text-xl text-foreground">
            {presentation.clientName}
          </p>
          <p className="mt-1 text-sm text-muted">
            {presentation.clientAddress || "Address pending"}
          </p>
        </div>
        <span className="rounded-full border border-border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-muted capitalize">
          {presentation.status}
        </span>
      </div>
      <p className="mt-4 text-sm text-muted">
        {tierLabel(presentation.tier)} ·{" "}
        {formatTierPrice(presentation.monthlyRate)}/mo
      </p>
    </Link>
  );
}
