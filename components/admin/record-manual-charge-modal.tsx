"use client";

import { useEffect, useState } from "react";
import type { BillingRegisterRow } from "@/lib/admin/billing-workspace-types";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { formatCurrency } from "@/lib/admin/sales-calculations";
import {
  craftInput,
  craftLabel,
  craftPrimaryButton,
  craftSecondaryButton,
} from "@/lib/craft/tokens";

import { businessTodayIsoDate } from "@/lib/admin/company-business-timezone";
function formatBillingPeriod(isoDate: string | null): string {
  if (!isoDate) return "—";
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function RecordManualChargeModal({
  row,
  onClose,
  onRecorded,
}: {
  row: BillingRegisterRow;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const [amount, setAmount] = useState(
    row.visitPrice != null ? String(row.visitPrice) : "",
  );
  const [chargeDate, setChargeDate] = useState(businessTodayIsoDate);
  const [stripeReference, setStripeReference] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const parsedAmount = Number(amount);
      const response = await fetch("/api/admin/billing-charges", {
        method: "POST",
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({
          membershipId: row.membershipId,
          amount: parsedAmount,
          chargeDate,
          stripeReference: stripeReference.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to record manual charge");
      }
      onRecorded();
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to record manual charge",
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
      aria-labelledby="record-charge-title"
    >
      <div className="flex max-h-[92svh] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border border-border bg-background sm:rounded-[2rem]">
        <div className="border-b border-border px-5 py-4 sm:px-6">
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted">
            Record external Stripe payment
          </p>
          <h3
            id="record-charge-title"
            className="mt-2 font-serif text-2xl font-light text-foreground"
          >
            {row.homeownerName}
          </h3>
          <p className="mt-2 text-sm text-muted">{row.propertyLabel}</p>
          <p className="mt-3 text-xs text-muted">
            Billing period: {formatBillingPeriod(row.billingPeriod)}
          </p>
        </div>

        <div className="space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <p className="text-sm leading-relaxed text-muted">
            Use this only after Stripe already shows a successful payment.
            HomeAtlas records the external payment; this screen never charges a
            card.
          </p>

          <label className="block">
            <span className={craftLabel}>Charge amount</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className={craftInput}
            />
            {row.visitPrice != null ? (
              <span className="mt-2 block text-xs text-muted">
                Visit price: {formatCurrency(row.visitPrice)}
              </span>
            ) : null}
          </label>

          <label className="block">
            <span className={craftLabel}>Charge date</span>
            <input
              type="date"
              value={chargeDate}
              onChange={(event) => setChargeDate(event.target.value)}
              className={craftInput}
            />
          </label>

          <label className="block">
            <span className={craftLabel}>Stripe payment ID (required)</span>
            <input
              type="text"
              value={stripeReference}
              onChange={(event) => setStripeReference(event.target.value)}
              placeholder="pi_… or ch_…"
              className={craftInput}
            />
          </label>

          <label className="block">
            <span className={craftLabel}>Internal notes (optional)</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              className={craftInput + " resize-none"}
            />
          </label>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className={craftSecondaryButton}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className={craftPrimaryButton}
          >
            {submitting ? "Saving…" : "Record existing Stripe payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
