"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import type {
  LeadIntakeSalesAssignment,
  LeadIntakeSalesRepOption,
} from "@/lib/sales/lead-intake-assignment";

function nextBusinessActionValue(reference = new Date()): string {
  const value = new Date(reference);
  value.setDate(value.getDate() + 1);
  value.setHours(9, 0, 0, 0);
  const offsetMs = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}

function localInputValue(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const offsetMs = parsed.getTimezoneOffset() * 60_000;
  return new Date(parsed.getTime() - offsetMs).toISOString().slice(0, 16);
}

function nextActionLabel(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Next action scheduled"
    : new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(parsed);
}

export function LeadAssignmentControl({
  leadIntakeId,
  initialAssignment = null,
  initialSalesReps = [],
  loadOnMount = false,
  compact = false,
  onChanged,
}: {
  leadIntakeId: string;
  initialAssignment?: LeadIntakeSalesAssignment | null;
  initialSalesReps?: LeadIntakeSalesRepOption[];
  loadOnMount?: boolean;
  compact?: boolean;
  onChanged?: (assignment: LeadIntakeSalesAssignment) => void;
}) {
  const [assignment, setAssignment] =
    useState<LeadIntakeSalesAssignment | null>(initialAssignment);
  const [salesReps, setSalesReps] =
    useState<LeadIntakeSalesRepOption[]>(initialSalesReps);
  const [repSlug, setRepSlug] = useState(
    initialAssignment?.repSlug ?? initialSalesReps[0]?.slug ?? "",
  );
  const [referenceTime] = useState(() => Date.now());
  const [nextFollowUpAt, setNextFollowUpAt] = useState(() =>
    initialAssignment
      ? localInputValue(initialAssignment.nextFollowUpAt)
      : nextBusinessActionValue(new Date(referenceTime)),
  );
  const [busy, setBusy] = useState(loadOnMount);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loadOnMount) return;
    let active = true;
    const request = fetch(
      `/api/admin/lead-intakes/${encodeURIComponent(leadIntakeId)}/assignment`,
      { headers: getAdminRequestHeaders(), cache: "no-store" },
    )
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          assignment?: LeadIntakeSalesAssignment | null;
          salesReps?: LeadIntakeSalesRepOption[];
          error?: string;
        } | null;
        if (!response.ok) {
          throw new Error(body?.error ?? "Could not load ownership.");
        }
        if (!active) return;
        const loadedAssignment = body?.assignment ?? null;
        const loadedReps = body?.salesReps ?? [];
        setAssignment(loadedAssignment);
        setSalesReps(loadedReps);
        setRepSlug(loadedAssignment?.repSlug ?? loadedReps[0]?.slug ?? "");
        if (loadedAssignment) {
          setNextFollowUpAt(localInputValue(loadedAssignment.nextFollowUpAt));
        }
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load ownership.",
        );
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    void request;
    return () => {
      active = false;
    };
  }, [leadIntakeId, loadOnMount]);

  const canSave = useMemo(() => {
    const timestamp = Date.parse(nextFollowUpAt);
    return Boolean(repSlug) && Number.isFinite(timestamp) && timestamp > referenceTime;
  }, [nextFollowUpAt, referenceTime, repSlug]);

  const save = async () => {
    if (!canSave || busy) return;
    if (Date.parse(nextFollowUpAt) <= Date.now()) {
      setError("The next action must still be in the future.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/lead-intakes/${encodeURIComponent(leadIntakeId)}/assignment`,
        {
          method: "POST",
          headers: getAdminRequestHeaders(),
          body: JSON.stringify({
            repSlug,
            nextFollowUpAt: new Date(nextFollowUpAt).toISOString(),
          }),
        },
      );
      const body = (await response.json().catch(() => null)) as {
        assignment?: LeadIntakeSalesAssignment;
        error?: string;
      } | null;
      if (!response.ok || !body?.assignment) {
        throw new Error(body?.error ?? "Could not save ownership.");
      }
      setAssignment(body.assignment);
      setRepSlug(body.assignment.repSlug);
      setNextFollowUpAt(localInputValue(body.assignment.nextFollowUpAt));
      onChanged?.(body.assignment);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save ownership.");
    } finally {
      setBusy(false);
    }
  };

  if (busy && loadOnMount && salesReps.length === 0 && !assignment) {
    return <p className="text-xs text-muted">Loading sales ownership…</p>;
  }

  return (
    <div
      className={
        compact
          ? "rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3"
          : "rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted">
            Sales owner
          </p>
          {assignment ? (
            <p className="mt-1 text-sm text-foreground">
              <Link
                href={assignment.repWorkspacePath}
                className="font-medium underline-offset-2 hover:text-accent hover:underline"
              >
                {assignment.repDisplayName}
              </Link>
              <span className="text-muted"> · {nextActionLabel(assignment.nextFollowUpAt)}</span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-foreground">Unassigned request</p>
          )}
        </div>
        {assignment ? (
          <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-emerald-200">
            Accountable
          </span>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto]">
        <label>
          <span className="sr-only">Salesperson</span>
          <select
            value={repSlug}
            disabled={busy || Boolean(assignment)}
            onChange={(event) => setRepSlug(event.target.value)}
            className="min-h-10 w-full rounded-xl border border-white/[0.08] bg-[#102019] px-3 text-xs text-foreground outline-none focus:border-accent/35 disabled:opacity-65"
          >
            {salesReps.length === 0 ? <option value="">No active reps</option> : null}
            {salesReps.map((rep) => (
              <option key={rep.id} value={rep.slug}>
                {rep.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Next action</span>
          <input
            type="datetime-local"
            value={nextFollowUpAt}
            min={localInputValue(new Date(referenceTime + 60_000).toISOString())}
            disabled={busy}
            onChange={(event) => setNextFollowUpAt(event.target.value)}
            className="min-h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-xs text-foreground outline-none focus:border-accent/35 disabled:opacity-65"
          />
        </label>
        <button
          type="button"
          disabled={!canSave || busy || salesReps.length === 0}
          onClick={() => void save()}
          className="min-h-10 rounded-xl border border-accent/35 bg-accent/10 px-4 text-[10px] font-medium uppercase tracking-[0.14em] text-accent transition hover:border-accent/60 disabled:opacity-40"
        >
          {busy ? "Saving…" : assignment ? "Update" : "Assign"}
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        Assignment only. No email or text is sent.
      </p>
      {error ? (
        <p className="mt-2 text-xs text-red-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
