"use client";

import { ServiceInterestChips } from "@/components/sales/service-interest-control";
import type {
  SalesLeadActionMoment,
  SalesLeadActionQueueItem,
} from "@/lib/sales/lead-action-priority";
import { salesRepLeadAnchorId } from "@/lib/sales/lead-intake-assignment";

const MOMENT_COPY: Record<
  SalesLeadActionMoment,
  { eyebrow: string; detail: string; className: string }
> = {
  overdue: {
    eyebrow: "Do this first · overdue",
    detail: "This promised next move has passed. Keep the relationship warm before the next door.",
    className: "border-red-300/35 bg-red-300/[0.08] text-red-50",
  },
  due_today: {
    eyebrow: "Today's next move",
    detail: "This homeowner is due today. Their context is ready without rebuilding the conversation.",
    className: "border-amber-200/35 bg-amber-200/[0.08] text-amber-50",
  },
  unscheduled: {
    eyebrow: "Choose the next move",
    detail: "This homeowner is remembered, but the relationship has no promised follow-up yet.",
    className: "border-sky-200/30 bg-sky-200/[0.07] text-sky-50",
  },
  upcoming: {
    eyebrow: "Upcoming follow-up",
    detail: "This homeowner already has a future next move.",
    className: "border-white/15 bg-white/[0.035] text-white",
  },
};

export function FieldNextMove({
  item,
  followUpLabel,
  remainingAttentionCount,
  openingPlan,
  onOpenPlan,
}: {
  item: SalesLeadActionQueueItem;
  followUpLabel: string;
  remainingAttentionCount: number;
  openingPlan: boolean;
  onOpenPlan: () => void;
}) {
  const { lead, moment } = item;
  const copy = MOMENT_COPY[moment];
  const phone = lead.phone?.replace(/[^\d+]/g, "") ?? "";
  const canCall = phone.length > 0;
  const canText = canCall && lead.smsConsentStatus === "opted_in";
  const canEmail = Boolean(lead.email) && lead.emailConsentStatus === "opted_in";
  const planLabel = lead.closeJourney?.actionLabel ?? "Build their plan";

  return (
    <section
      aria-labelledby="field-next-move-title"
      className={`mb-5 overflow-hidden rounded-[1.5rem] border p-4 shadow-[0_18px_55px_rgba(0,0,0,0.24)] sm:p-5 ${copy.className}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.19em] opacity-75">
            {copy.eyebrow}
          </p>
          <h2 id="field-next-move-title" className="mt-2 truncate font-serif text-2xl sm:text-3xl">
            {lead.fullName}
          </h2>
          <p className="mt-1 truncate text-xs opacity-65">{lead.propertyAddress}</p>
          <ServiceInterestChips interests={lead.serviceInterests} className="mt-3" />
        </div>
        <div className="shrink-0 rounded-xl border border-current/15 bg-black/15 px-3 py-2 sm:text-right">
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] opacity-65">
            Next action
          </p>
          <p className="mt-1 text-xs font-semibold">{followUpLabel}</p>
        </div>
      </div>

      <p className="mt-4 max-w-2xl text-xs leading-5 opacity-70">{copy.detail}</p>

      <div className="mt-4 grid grid-cols-2 gap-2 min-[520px]:flex min-[520px]:flex-wrap">
        {canCall ? (
          <a
            href={`tel:${phone}`}
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-current/25 bg-black/15 px-4 text-[10px] font-bold uppercase tracking-[0.12em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            Call
          </a>
        ) : null}
        {canText ? (
          <a
            href={`sms:${phone}`}
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-current/25 bg-black/15 px-4 text-[10px] font-bold uppercase tracking-[0.12em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            Text
          </a>
        ) : null}
        {canEmail ? (
          <a
            href={`mailto:${encodeURIComponent(lead.email ?? "")}`}
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-current/25 bg-black/15 px-4 text-[10px] font-bold uppercase tracking-[0.12em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            Email
          </a>
        ) : null}
        <button
          type="button"
          onClick={onOpenPlan}
          disabled={openingPlan}
          className="col-span-2 inline-flex min-h-12 items-center justify-center rounded-full border border-white/40 bg-white px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#111] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white min-[520px]:col-auto"
        >
          {openingPlan ? "Opening plan…" : planLabel}
        </button>
        <a
          href={`#${salesRepLeadAnchorId(lead.id)}`}
          className="col-span-2 inline-flex min-h-12 items-center justify-center rounded-full border border-current/25 bg-black/10 px-4 text-[10px] font-bold uppercase tracking-[0.12em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current min-[520px]:col-auto"
        >
          Open full record
        </a>
      </div>

      <div className="mt-4 flex flex-col gap-1 border-t border-current/12 pt-3 text-[10px] leading-4 opacity-60 sm:flex-row sm:items-center sm:justify-between">
        <p>Calling or opening your phone&apos;s message app never sends by itself.</p>
        {remainingAttentionCount > 0 ? (
          <p className="font-semibold uppercase tracking-[0.1em]">
            +{remainingAttentionCount} more needing attention
          </p>
        ) : null}
      </div>
    </section>
  );
}
