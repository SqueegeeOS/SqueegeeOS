"use client";

import Link from "next/link";
import type { PresentationData } from "@/lib/presentations/types";
import { customerWorkspaceHref } from "@/lib/hq/customer-workspace/routes";
import { tierLabel } from "@/lib/presentations/types";
import { formatTierPrice } from "@/lib/membership/tier-config";
import { visitRateFromPresentation } from "@/lib/presentations/calculations";

export function PresentationCard({
  presentation,
}: {
  presentation: PresentationData;
}) {
  const visitRate = visitRateFromPresentation(presentation);
  const workspaceType = presentation.propertyId ? "property" : "presentation";
  const workspaceId = presentation.propertyId ?? presentation.id;

  return (
    <Link
      href={customerWorkspaceHref(workspaceType, workspaceId)}
      className="block rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] px-5 py-4 transition-colors active:border-[#c9a96e]/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-white">
            {presentation.clientName || "Untitled client"}
          </p>
          <p className="mt-0.5 truncate text-sm text-[#555]">
            {presentation.clientAddress || "Address not set"}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-[#222] px-2 py-0.5 text-[9px] uppercase tracking-widest text-[#555]">
          {presentation.status}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-[#666]">
          {tierLabel(presentation.tier)} · {formatTierPrice(visitRate)}/visit
        </p>
        <span className="text-xs text-[#c9a96e]">Workspace →</span>
      </div>
    </Link>
  );
}
