"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { HqMembershipRow } from "@/app/api/admin/memberships/route";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import {
  craftInput,
  craftLabel,
  craftSecondaryButton,
} from "@/lib/craft/tokens";

function defaultServiceDate(row: HqMembershipRow): string {
  if (row.nextServiceDate) return row.nextServiceDate;
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-15`;
}

export function ScheduleMembershipButton({
  row,
  onScheduled,
}: {
  row: HqMembershipRow;
  onScheduled: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);

  if (row.rawStatus !== "active") {
    return null;
  }

  if (row.status !== "needs scheduling" && row.status !== "scheduled") {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-full border border-accent/35 bg-accent/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-accent transition hover:border-accent/50 hover:bg-accent/15"
      >
        {row.status === "scheduled" ? "Update schedule" : "Schedule"}
      </button>
      {open ? (
        <ScheduleMembershipModal
          row={row}
          onClose={() => setOpen(false)}
          onScheduled={(message) => {
            setOpen(false);
            onScheduled(message);
          }}
        />
      ) : null}
    </>
  );
}

function ScheduleMembershipModal({
  row,
  onClose,
  onScheduled,
}: {
  row: HqMembershipRow;
  onClose: () => void;
  onScheduled: (message: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [serviceDate, setServiceDate] = useState(defaultServiceDate(row));
  const [timeWindow, setTimeWindow] = useState(row.nextServiceTimeWindow ?? "");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, submitting]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/memberships/${row.id}/schedule`, {
        method: "POST",
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({
          serviceDate,
          timeWindow: timeWindow.trim() || undefined,
          note: note.trim() || undefined,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to schedule service");
      }
      onScheduled(
        body?.message ??
          `Next service scheduled for ${row.customerName}.`,
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to schedule service",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200] isolate"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-membership-title"
    >
      <button
        type="button"
        aria-label="Close schedule dialog"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => {
          if (!submitting) onClose();
        }}
      />

      <div className="pointer-events-none relative z-[1] flex h-full max-h-[100dvh] items-end justify-center p-0 sm:items-center sm:p-5">
        <div className="pointer-events-auto relative z-[2] flex max-h-[min(92dvh,92svh)] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border border-border bg-background shadow-2xl sm:max-h-[min(88dvh,88svh)] sm:rounded-[2rem]">
          <div className="shrink-0 border-b border-border px-5 py-4 sm:px-6">
            <p className="text-[10px] uppercase tracking-[0.24em] text-accent">
              Schedule service
            </p>
            <h3
              id="schedule-membership-title"
              className="mt-2 font-serif text-2xl font-light text-foreground"
            >
              Assign next visit
            </h3>
            <p className="mt-2 text-sm text-muted">
              {row.customerName} · {row.planLabel}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
            <div className="space-y-5">
              <p className="text-sm leading-relaxed text-muted">
                Saves a real upcoming visit to member appointments. The customer
                portal will show this date when their profile is connected.
              </p>

              <label className="block">
                <span className={craftLabel}>Service date</span>
                <input
                  type="date"
                  value={serviceDate}
                  onChange={(event) => setServiceDate(event.target.value)}
                  className={craftInput}
                  required
                />
              </label>

              <label className="block">
                <span className={craftLabel}>Time window (optional)</span>
                <input
                  type="text"
                  value={timeWindow}
                  onChange={(event) => setTimeWindow(event.target.value)}
                  placeholder="Morning · 8am–12pm"
                  className={craftInput}
                />
              </label>

              <label className="block">
                <span className={craftLabel}>Internal note (optional)</span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={2}
                  placeholder="Gate code, dogs, preferred tech…"
                  className={craftInput + " resize-none"}
                />
              </label>
            </div>
          </div>

          <div className="relative z-10 shrink-0 border-t border-border bg-background px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-12px_32px_rgba(0,0,0,0.35)] sm:px-6">
            {error ? (
              <p className="mb-3 text-sm text-red-400" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className={`w-full sm:w-auto ${craftSecondaryButton}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting || !serviceDate}
                aria-busy={submitting}
                className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full border border-accent/40 bg-accent px-6 text-sm font-medium tracking-[0.08em] text-background shadow-[0_8px_24px_rgba(127,99,29,0.35)] transition hover:opacity-95 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
              >
                {submitting ? "Saving…" : "Save schedule"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
