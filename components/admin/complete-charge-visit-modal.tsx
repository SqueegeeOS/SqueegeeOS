"use client";

import { useMemo, useState } from "react";
import type { BillingRegisterRow } from "@/lib/admin/billing-workspace-types";
import {
  calculateVisitChargeTotals,
  type VisitChargeLineInput,
} from "@/lib/admin/complete-charge-visit-shared";
import { businessTodayIsoDate } from "@/lib/admin/company-business-timezone";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { formatCurrency } from "@/lib/admin/sales-calculations";
import {
  craftInput,
  craftLabel,
  craftPrimaryButton,
  craftSecondaryButton,
} from "@/lib/craft/tokens";

function createLine(
  kind: VisitChargeLineInput["kind"],
  values?: Partial<VisitChargeLineInput>,
): VisitChargeLineInput {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    kind,
    serviceName: "",
    retailPrice: 0,
    amountCharged: 0,
    ...values,
  };
}

interface ChargeResult {
  outcome: "paid" | "already_paid" | "declined";
  invoiceId: string | null;
  amountChargedCents: number;
  savingsRecordedCents: number;
  message: string;
}

export function CompleteChargeVisitModal({
  row,
  onClose,
  onRecorded,
}: {
  row: BillingRegisterRow;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const visitPrice = row.visitPrice ?? 0;
  const visitSavings = row.enrollmentSavingsPerVisit ?? 0;
  const [serviceDate, setServiceDate] = useState(
    row.nextAppointmentDate?.slice(0, 10) ?? businessTodayIsoDate(),
  );
  const [lines, setLines] = useState<VisitChargeLineInput[]>([
    createLine("membership_visit", {
      serviceName: "Window cleaning",
      retailPrice: visitPrice + visitSavings,
      amountCharged: visitPrice,
    }),
  ]);
  const [internalNote, setInternalNote] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ChargeResult | null>(null);

  const totals = useMemo(() => calculateVisitChargeTotals(lines), [lines]);

  const updateLine = (
    id: string,
    patch: Partial<VisitChargeLineInput>,
  ) => {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
    setReviewing(false);
    setResult(null);
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/memberships/${encodeURIComponent(row.membershipId)}/complete-charge`,
        {
          method: "POST",
          headers: getAdminRequestHeaders(),
          body: JSON.stringify({
            appointmentId: row.nextAppointmentId,
            serviceDate,
            lines,
            internalNote: internalNote.trim() || undefined,
          }),
        },
      );
      const body = (await response.json().catch(() => null)) as
        | (ChargeResult & { error?: string })
        | null;
      if (!body || (!response.ok && !body.outcome)) {
        throw new Error(body?.error ?? "Complete and charge failed");
      }
      setResult(body);
      onRecorded();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Complete and charge failed",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="complete-charge-title"
    >
      <div className="flex max-h-[94svh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[1.75rem] border border-border bg-background sm:rounded-[2rem]">
        <header className="border-b border-border px-5 py-5 sm:px-7">
          <p className="text-[10px] uppercase tracking-[0.24em] text-accent">
            Complete &amp; charge visit
          </p>
          <h3
            id="complete-charge-title"
            className="mt-2 font-serif text-2xl font-light text-foreground"
          >
            {row.homeownerName}
          </h3>
          <p className="mt-2 text-sm text-muted">{row.propertyLabel}</p>
        </header>

        <div className="space-y-6 overflow-y-auto px-5 py-5 sm:px-7">
          {result ? (
            <div
              className={`rounded-2xl border p-5 ${
                result.outcome === "declined"
                  ? "border-red-500/30 bg-red-500/10"
                  : "border-emerald-500/30 bg-emerald-500/10"
              }`}
            >
              <p className="font-serif text-xl text-foreground">
                {result.outcome === "declined"
                  ? "Visit recorded. Payment needs attention."
                  : "Visit complete and paid."}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {result.message}
              </p>
              <p className="mt-3 text-xs text-muted">
                Charged {formatCurrency(result.amountChargedCents / 100)} ·
                Savings recorded {formatCurrency(result.savingsRecordedCents / 100)}
              </p>
              {result.invoiceId ? (
                <p className="mt-2 font-mono text-xs text-muted">
                  {result.invoiceId}
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <label className="block">
                <span className={craftLabel}>Service date</span>
                <input
                  type="date"
                  value={serviceDate}
                  onChange={(event) => {
                    setServiceDate(event.target.value);
                    setReviewing(false);
                  }}
                  className={craftInput}
                />
              </label>

              <div className="space-y-3">
                {lines.map((line, index) => {
                  const saved = Math.max(0, line.retailPrice - line.amountCharged);
                  return (
                    <div
                      key={line.id}
                      className="rounded-2xl border border-border/70 bg-foreground/[0.025] p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <select
                          value={line.kind}
                          onChange={(event) =>
                            updateLine(line.id, {
                              kind: event.target.value as VisitChargeLineInput["kind"],
                            })
                          }
                          className={craftInput}
                        >
                          <option value="membership_visit">Membership visit</option>
                          <option value="addon_service">Add-on service</option>
                        </select>
                        {lines.length > 1 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setLines((current) =>
                                current.filter((item) => item.id !== line.id),
                              )
                            }
                            className="text-xs text-muted hover:text-foreground"
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                      <label className="mt-3 block">
                        <span className={craftLabel}>Service {index + 1}</span>
                        <input
                          value={line.serviceName}
                          onChange={(event) =>
                            updateLine(line.id, { serviceName: event.target.value })
                          }
                          placeholder="Roof treatment"
                          className={craftInput}
                        />
                      </label>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <label>
                          <span className={craftLabel}>Retail value</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.retailPrice || ""}
                            onChange={(event) =>
                              updateLine(line.id, {
                                retailPrice: Number(event.target.value),
                              })
                            }
                            className={craftInput}
                          />
                        </label>
                        <label>
                          <span className={craftLabel}>Charge</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.amountCharged || ""}
                            onChange={(event) =>
                              updateLine(line.id, {
                                amountCharged: Number(event.target.value),
                              })
                            }
                            className={craftInput}
                          />
                        </label>
                      </div>
                      <p className="mt-3 text-xs text-accent">
                        Member saves {formatCurrency(saved)}
                      </p>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() =>
                    setLines((current) => [
                      ...current,
                      createLine("addon_service", { serviceName: "" }),
                    ])
                  }
                  className={craftSecondaryButton}
                >
                  Add service
                </button>
              </div>

              <label className="block">
                <span className={craftLabel}>Internal note (optional)</span>
                <textarea
                  value={internalNote}
                  onChange={(event) => setInternalNote(event.target.value)}
                  rows={3}
                  className={`${craftInput} resize-none`}
                />
              </label>

              <div className="rounded-2xl border border-accent/25 bg-accent/[0.06] p-5">
                <div className="flex justify-between text-sm text-muted">
                  <span>Retail value</span>
                  <span>{formatCurrency(totals.retailTotalCents / 100)}</span>
                </div>
                <div className="mt-2 flex justify-between text-sm text-accent">
                  <span>Member savings</span>
                  <span>{formatCurrency(totals.savingsTotalCents / 100)}</span>
                </div>
                <div className="mt-4 flex justify-between border-t border-border pt-4 font-serif text-xl text-foreground">
                  <span>Charge saved card</span>
                  <span>{formatCurrency(totals.chargeTotalCents / 100)}</span>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted">
                  {row.cardOnFileLabel ?? "Saved card"}. One invoice is created
                  for this visit; retries reuse it and cannot create a duplicate.
                </p>
              </div>

              {reviewing ? (
                <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  Final review: this will complete the scheduled visit, record
                  {` ${formatCurrency(totals.savingsTotalCents / 100)} `}
                  in savings, and immediately charge
                  {` ${formatCurrency(totals.chargeTotalCents / 100)}.`}
                </p>
              ) : null}
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
            </>
          )}
        </div>

        <footer className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className={craftSecondaryButton}
          >
            {result ? "Done" : "Cancel"}
          </button>
          {!result ? (
            <button
              type="button"
              onClick={() =>
                reviewing ? void submit() : setReviewing(true)
              }
              disabled={submitting || !row.nextAppointmentId}
              className={craftPrimaryButton}
            >
              {submitting
                ? "Processing…"
                : reviewing
                  ? `Complete & charge ${formatCurrency(totals.chargeTotalCents / 100)}`
                  : "Review charge"}
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
