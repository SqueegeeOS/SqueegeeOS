"use client";

import { useEffect, useState } from "react";
import type { HqMembershipRow } from "@/app/api/admin/memberships/route";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import {
  craftInput,
  craftLabel,
  craftSecondaryButton,
} from "@/lib/craft/tokens";

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 13a1 1 0 0 0 1 .9h8a1 1 0 0 0 1-.9L18 7" />
    </svg>
  );
}

export function ArchiveMembershipButton({
  row,
  onArchived,
}: {
  row: HqMembershipRow;
  onArchived: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);

  if (row.rawStatus === "cancelled") {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border/40 px-2.5 py-1.5 text-[11px] uppercase tracking-[0.14em] text-muted transition hover:border-red-500/35 hover:text-red-300"
        aria-label={`Archive membership for ${row.customerName}`}
      >
        <TrashIcon className="h-3.5 w-3.5" />
        <span className="sr-only sm:not-sr-only">Archive</span>
      </button>
      {open ? (
        <ArchiveMembershipModal
          row={row}
          onClose={() => setOpen(false)}
          onArchived={(message) => {
            setOpen(false);
            onArchived(message);
          }}
        />
      ) : null}
    </>
  );
}

function ArchiveMembershipModal({
  row,
  onClose,
  onArchived,
}: {
  row: HqMembershipRow;
  onClose: () => void;
  onArchived: (message: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, submitting]);

  const handleArchive = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/memberships/${row.id}/archive`, {
        method: "POST",
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({
          reason: reason.trim() || undefined,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to archive membership");
      }
      onArchived(
        body?.message ??
          `${row.customerName} archived and removed from active HQ view.`,
      );
    } catch (archiveError) {
      setError(
        archiveError instanceof Error
          ? archiveError.message
          : "Failed to archive membership",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onClick={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="archive-membership-title"
    >
      <div className="flex max-h-[min(92dvh,92svh)] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border border-border bg-background shadow-2xl sm:max-h-[min(88dvh,88svh)] sm:rounded-[2rem]">
        <div className="shrink-0 border-b border-border px-5 py-4 sm:px-6">
          <p className="text-[10px] uppercase tracking-[0.24em] text-red-300/90">
            Archive membership
          </p>
          <h3
            id="archive-membership-title"
            className="mt-2 font-serif text-2xl font-light text-foreground"
          >
            Remove from active HQ view?
          </h3>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          <div className="space-y-5">
            <p className="text-sm leading-relaxed text-muted">
              This updates the production membership record to{" "}
              <span className="text-foreground">cancelled</span>. Signed
              agreements, property history, billing charges, and Stripe customer
              records are preserved. Stripe payment methods are not deleted.
            </p>

            <dl className="space-y-3 rounded-2xl border border-border/50 bg-foreground/[0.03] px-4 py-4 text-sm">
              <div>
                <dt className="text-[10px] uppercase tracking-[0.16em] text-muted/80">
                  Customer
                </dt>
                <dd className="mt-1 text-foreground">{row.customerName}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.16em] text-muted/80">
                  Property
                </dt>
                <dd className="mt-1 text-foreground/90">{row.address}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.16em] text-muted/80">
                  Membership ID
                </dt>
                <dd className="mt-1 break-all font-mono text-xs text-foreground/90">
                  {row.id}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.16em] text-muted/80">
                  Agreement ID
                </dt>
                <dd className="mt-1 break-all font-mono text-xs text-foreground/90">
                  {row.agreementId ?? "—"}
                </dd>
              </div>
            </dl>

            <label className="block">
              <span className={craftLabel}>Reason (optional)</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={2}
                placeholder="Test record, duplicate enrollment, wrong property…"
                className={craftInput + " resize-none"}
              />
            </label>
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-background px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
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
              onClick={() => void handleArchive()}
              disabled={submitting}
              aria-busy={submitting}
              className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full border border-red-400/50 bg-red-500/90 px-6 text-sm font-medium tracking-[0.08em] text-white shadow-[0_8px_24px_rgba(127,29,29,0.35)] transition hover:bg-red-500 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
            >
              {submitting ? "Archiving…" : "Archive membership"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
