"use client";

import { useEffect, useMemo, useState } from "react";
import { FieldPropertyAddressInput } from "@/components/address/field-property-address-input";
import { GlassCard } from "@/components/craft/glass-card";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import {
  craftEyebrow,
  craftHeading,
  craftInput,
  craftLabel,
  craftPrimaryButton,
  craftSecondaryButton,
  craftTextarea,
} from "@/lib/craft/tokens";
import {
  SALES_DOOR_DISPOSITIONS,
  normalizeSalesDoorAddressKey,
  salesDoorDispositionCountsConversation,
  salesDoorDispositionLabel,
  type SalesDoorDisposition,
} from "@/lib/sales/door-memory";
import type { SalesDoorMemory } from "@/lib/sales/workspace-types";

export interface DoorMemoryDraft {
  doorActivityClientEventId: string;
  clientEventId: string;
  propertyAddress: string;
  disposition: SalesDoorDisposition | null;
  notes: string;
}

const DISPOSITION_DETAIL: Record<SalesDoorDisposition, string> = {
  not_home: "Nobody answered",
  conversation: "Had a conversation · +1 talk",
  follow_up: "Come back or reconnect · +1 talk",
  interested: "Ready for the next step · +1 talk",
  not_interested: "Not moving forward now",
  do_not_knock: "Never approach again",
};

const DISPOSITION_STYLE: Record<SalesDoorDisposition, string> = {
  not_home: "border-white/15 bg-white/[0.04] text-foreground",
  conversation: "border-sky-300/35 bg-sky-300/[0.08] text-sky-100",
  follow_up: "border-amber-300/40 bg-amber-300/[0.1] text-amber-50",
  interested: "border-emerald-300/45 bg-emerald-300/[0.12] text-emerald-50",
  not_interested: "border-white/12 bg-white/[0.025] text-muted",
  do_not_knock: "border-red-300/45 bg-red-300/[0.1] text-red-100",
};
const DOOR_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function doorDateLabel(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Time unavailable";
  return DOOR_DATE_FORMATTER.format(date);
}

export function DoorMemorySheet({
  repSlug,
  draft,
  recentMemories,
  saving,
  activityPending,
  onChange,
  onCancel,
  onSave,
}: {
  repSlug: string;
  draft: DoorMemoryDraft;
  recentMemories: SalesDoorMemory[];
  saving: boolean;
  activityPending: boolean;
  onChange: (next: DoorMemoryDraft) => void;
  onCancel: () => void;
  onSave: (intent: "move-on" | "add-homeowner") => void;
}) {
  const addressKey = normalizeSalesDoorAddressKey(draft.propertyAddress);
  const [addressLookup, setAddressLookup] = useState<{
    key: string;
    history: SalesDoorMemory[];
    error: boolean;
  } | null>(null);
  useEffect(() => {
    if (draft.propertyAddress.trim().length < 5 || addressKey.length < 3) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/sales/${encodeURIComponent(repSlug)}/workspace?address=${encodeURIComponent(draft.propertyAddress)}`,
          {
            cache: "no-store",
            headers: getAdminRequestHeaders(),
            signal: controller.signal,
          },
        );
        const body = (await response.json().catch(() => null)) as
          | { history?: SalesDoorMemory[]; error?: string }
          | null;
        if (!response.ok || !Array.isArray(body?.history)) {
          throw new Error(body?.error ?? "Address history unavailable.");
        }
        setAddressLookup({ key: addressKey, history: body.history, error: false });
      } catch {
        if (controller.signal.aborted) return;
        setAddressLookup({ key: addressKey, history: [], error: true });
      }
    }, 300);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [addressKey, draft.propertyAddress, repSlug]);
  const priorAtAddress = useMemo(
    () => {
      if (addressLookup?.key === addressKey && addressLookup.history.length > 0) {
        return addressLookup.history[0];
      }
      return addressKey.length >= 3
        ? recentMemories.find(
            (memory) =>
              normalizeSalesDoorAddressKey(memory.propertyAddress) === addressKey,
          ) ?? null
        : null;
    },
    [addressKey, addressLookup, recentMemories],
  );
  const wantsHomeowner =
    draft.disposition === "interested" || draft.disposition === "follow_up";
  const ready =
    draft.propertyAddress.trim().length >= 5 && draft.disposition !== null;

  return (
    <div
      className="fixed inset-0 z-[75] overflow-y-auto bg-black/75 px-3 py-4 backdrop-blur-md sm:px-6 sm:py-10"
      role="dialog"
      aria-modal="true"
      aria-labelledby="door-memory-title"
    >
      <div className="mx-auto max-w-2xl">
        <GlassCard tone="elevated" padding="lg" className="!bg-[#0d0b08]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className={craftEyebrow}>Door memory</p>
              <h2 id="door-memory-title" className={`mt-2 text-3xl ${craftHeading}`}>
                What happened here?
              </h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-muted">
                The knock is counted. Add the address so HomeAtlas remembers this
                house for the whole team.
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/[0.1] text-xl text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              aria-label="Close door memory"
            >
              ×
            </button>
          </div>

          <div className="mt-7">
            <label htmlFor="door-memory-address" className={craftLabel}>
              Property address
            </label>
            <FieldPropertyAddressInput
              id="door-memory-address"
              autoFocus
              value={draft.propertyAddress}
              onChange={(propertyAddress) =>
                onChange({ ...draft, propertyAddress })
              }
              className={craftInput}
              placeholder="House number and street"
            />
            {addressKey.length >= 3 && addressLookup?.key !== addressKey ? (
              <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-muted">
                Checking saved address history…
              </p>
            ) : addressLookup?.key === addressKey && addressLookup.error ? (
              <p className="mt-2 text-xs text-amber-200" role="status">
                Saved address check is unavailable. Recent results still
                appear below when available.
              </p>
            ) : null}
          </div>

          {priorAtAddress ? (
            <div
              className={`mt-3 rounded-2xl border px-4 py-3 ${
                priorAtAddress.disposition === "do_not_knock"
                  ? "border-red-300/55 bg-red-300/[0.12] text-red-50"
                  : "border-amber-300/40 bg-amber-300/[0.09] text-amber-50"
              }`}
              role="alert"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.16em]">
                Prior address history
              </p>
              <p className="mt-1 text-sm font-semibold">
                {salesDoorDispositionLabel(priorAtAddress.disposition)} ·{" "}
                {doorDateLabel(priorAtAddress.occurredAt)}
              </p>
              {priorAtAddress.notes ? (
                <p className="mt-1 text-xs leading-5 opacity-80">{priorAtAddress.notes}</p>
              ) : null}
            </div>
          ) : null}

          <fieldset className="mt-6">
            <legend className={craftLabel}>Doorstep result</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SALES_DOOR_DISPOSITIONS.map((disposition) => {
                const selected = draft.disposition === disposition;
                return (
                  <button
                    key={disposition}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onChange({ ...draft, disposition })}
                    className={`min-h-[5.25rem] touch-manipulation rounded-2xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98] motion-reduce:transition-none ${
                      DISPOSITION_STYLE[disposition]
                    } ${selected ? "ring-2 ring-accent ring-offset-2 ring-offset-[#0d0b08]" : ""}`}
                  >
                    <span className="block text-xs font-bold uppercase tracking-[0.1em]">
                      {salesDoorDispositionLabel(disposition)}
                    </span>
                    <span className="mt-1 block text-[10px] leading-4 opacity-70">
                      {DISPOSITION_DETAIL[disposition]}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-6">
            <label htmlFor="door-memory-notes" className={craftLabel}>
              Quick note <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <textarea
              id="door-memory-notes"
              rows={3}
              maxLength={1200}
              value={draft.notes}
              onChange={(event) => onChange({ ...draft, notes: event.target.value })}
              className={craftTextarea}
              placeholder="Gate code, best time to return, what they cared about…"
            />
          </div>

          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={onCancel} className={craftSecondaryButton}>
              Just count the knock
            </button>
            <button
              type="button"
              disabled={!ready || saving || activityPending}
              onClick={() => onSave(wantsHomeowner ? "add-homeowner" : "move-on")}
              className={craftPrimaryButton}
            >
              {activityPending
                ? "Syncing knock…"
                : saving
                  ? "Saving door…"
                  : wantsHomeowner
                    ? "Save & add homeowner"
                    : "Save door & move on"}
            </button>
          </div>
          {draft.disposition &&
          salesDoorDispositionCountsConversation(draft.disposition) ? (
            <p className="mt-3 text-center text-[10px] font-semibold leading-4 text-sky-100 sm:text-right">
              This outcome counts one conversation automatically. No second tap
              needed.
            </p>
          ) : null}
          <p className="mt-3 text-center text-[10px] leading-4 text-muted/65 sm:text-right">
            Private field history only. This does not text, email, enroll, or charge
            anyone.
          </p>
        </GlassCard>
      </div>
    </div>
  );
}

export function DoorMemoryTimeline({
  memories,
  status,
  loading,
}: {
  memories: SalesDoorMemory[];
  status: "complete" | "unavailable";
  loading: boolean;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeSalesDoorAddressKey(query);
  const visible = useMemo(
    () =>
      (normalizedQuery
        ? memories.filter((memory) =>
            normalizeSalesDoorAddressKey(memory.propertyAddress).includes(
              normalizedQuery,
            ),
          )
        : memories
      ).slice(0, 8),
    [memories, normalizedQuery],
  );

  return (
    <GlassCard as="section" tone="subtle" padding="lg" className="mt-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={craftEyebrow}>Door memory</p>
          <h2 className={`mt-2 text-2xl sm:text-3xl ${craftHeading}`}>
            Every house stays remembered.
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Search recent addresses before circling back. Do-not-knock results stay
            bright red.
          </p>
        </div>
        {memories.length > 0 ? (
          <div className="w-full sm:max-w-xs">
            <label htmlFor="door-memory-search" className="sr-only">
              Search recent door addresses
            </label>
            <input
              id="door-memory-search"
              type="search"
              inputMode="search"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={craftInput}
              placeholder="Check an address"
            />
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-5 rounded-2xl border border-white/[0.08] px-5 py-7 text-center text-sm text-muted" role="status">
          Loading private address history…
        </div>
      ) : status === "unavailable" ? (
        <div className="mt-5 rounded-2xl border border-amber-300/35 bg-amber-300/[0.08] px-4 py-3 text-sm text-amber-50" role="status">
          Recent address history is temporarily unavailable. Field totals and the
          homeowner queue are still safe.
        </div>
      ) : memories.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-white/[0.1] px-5 py-7 text-center">
          <p className="font-serif text-lg text-foreground">No saved addresses yet.</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Tap Next door, then save the doorstep result to start the field history.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-white/[0.1] px-5 py-7 text-center">
          <p className="font-serif text-lg text-foreground">No recent address match.</p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="mt-3 min-h-11 rounded-full px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {visible.map((memory) => (
            <article
              key={memory.id}
              className={`rounded-2xl border p-4 ${DISPOSITION_STYLE[memory.disposition]}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold">
                    {memory.propertyAddress}
                  </h3>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.14em] opacity-70">
                    {doorDateLabel(memory.occurredAt)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-current/20 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em]">
                  {salesDoorDispositionLabel(memory.disposition)}
                </span>
              </div>
              {memory.notes ? (
                <p className="mt-3 line-clamp-2 text-xs leading-5 opacity-75">
                  {memory.notes}
                </p>
              ) : null}
              {memory.leadId ? (
                <p className="mt-3 text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-200">
                  Homeowner linked
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
