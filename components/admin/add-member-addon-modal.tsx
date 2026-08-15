"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { HqMembershipRow } from "@/app/api/admin/memberships/route";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { businessTodayIsoDate } from "@/lib/admin/company-business-timezone";
import { defaultAddonDiscountForTier } from "@/lib/admin/record-member-addon-shared";
import type { MemberAddonStatus } from "@/lib/persistence/types/member-addon";
import {
  craftInput,
  craftLabel,
  craftSecondaryButton,
} from "@/lib/craft/tokens";

const STATUS_OPTIONS: Array<{ id: MemberAddonStatus; label: string }> = [
  { id: "quoted", label: "Quoted" },
  { id: "scheduled", label: "Scheduled" },
  { id: "completed", label: "Completed" },
  { id: "paid", label: "Paid elsewhere — record only" },
];

const QUICK_SERVICES = [
  { name: "Screen cleaning", memberAmount: 50 },
  { name: "Interior window cleaning", memberAmount: 100 },
  { name: "Cobweb removal", memberAmount: 50 },
] as const;

type CollectionMode = "stripe_checkout" | "record_only";

const subscribeToClient = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function money(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export function AddMemberAddonButton({
  row,
  onRecorded,
}: {
  row: HqMembershipRow;
  onRecorded: (message: string) => void;
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
        className="inline-flex items-center rounded-full border border-border bg-surface/40 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-foreground/80 transition hover:border-accent/35 hover:text-accent"
      >
        Add service
      </button>
      {open ? (
        <AddMemberAddonModal
          row={row}
          onClose={() => setOpen(false)}
          onRecorded={(message) => {
            setOpen(false);
            onRecorded(message);
          }}
        />
      ) : null}
    </>
  );
}

function AddMemberAddonModal({
  row,
  onClose,
  onRecorded,
}: {
  row: HqMembershipRow;
  onClose: () => void;
  onRecorded: (message: string) => void;
}) {
  const defaultDiscount = defaultAddonDiscountForTier(row.tier);
  const mounted = useSyncExternalStore(
    subscribeToClient,
    getClientSnapshot,
    getServerSnapshot,
  );
  const [serviceName, setServiceName] = useState("");
  const [serviceDate, setServiceDate] = useState(businessTodayIsoDate);
  const [retailPrice, setRetailPrice] = useState("");
  const [discountPercent, setDiscountPercent] = useState(String(defaultDiscount));
  const [amountCharged, setAmountCharged] = useState("");
  const [status, setStatus] = useState<MemberAddonStatus>("quoted");
  const [collectionMode, setCollectionMode] =
    useState<CollectionMode>("stripe_checkout");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const retailNumber = Number(retailPrice);
  const chargedNumber = Number(amountCharged);
  const savingsPreview = useMemo(() => {
    if (!Number.isFinite(retailNumber) || !Number.isFinite(chargedNumber)) {
      return null;
    }
    return Math.max(0, retailNumber - chargedNumber);
  }, [retailNumber, chargedNumber]);

  const dismiss = useCallback(() => {
    if (paymentUrl) {
      onRecorded(
        successMessage ?? `Payment link created for ${row.customerName}.`,
      );
      return;
    }
    onClose();
  }, [onClose, onRecorded, paymentUrl, row.customerName, successMessage]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) dismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dismiss, submitting]);

  const applySuggestedCharge = () => {
    if (!Number.isFinite(retailNumber) || retailNumber <= 0) return;
    const discount = Number(discountPercent);
    if (!Number.isFinite(discount)) return;
    const suggested = retailNumber * (1 - discount / 100);
    setAmountCharged(suggested.toFixed(2));
  };

  const applyQuickService = (service: (typeof QUICK_SERVICES)[number]) => {
    const discount = Number(discountPercent);
    const multiplier =
      Number.isFinite(discount) && discount > 0 && discount < 100
        ? 1 - discount / 100
        : 1;
    setServiceName(service.name);
    setRetailPrice((service.memberAmount / multiplier).toFixed(2));
    setAmountCharged(service.memberAmount.toFixed(2));
  };

  const copyPaymentUrl = async () => {
    if (!paymentUrl) return;
    try {
      await navigator.clipboard.writeText(paymentUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setError("Copy failed. Select the link and copy it manually.");
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/memberships/${row.id}/addon`, {
        method: "POST",
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({
          serviceName,
          serviceDate,
          retailPrice: retailNumber,
          discountPercent: Number(discountPercent),
          amountCharged: chargedNumber,
          status,
          collectionMode,
          notes: notes.trim() || undefined,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
        paymentUrl?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to record add-on service");
      }
      const message =
        body?.message ?? `Add-on recorded for ${row.customerName}.`;
      if (collectionMode === "stripe_checkout" && body?.paymentUrl) {
        setPaymentUrl(body.paymentUrl);
        setSuccessMessage(message);
        return;
      }
      onRecorded(message);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to record add-on service",
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
      aria-labelledby="add-member-addon-title"
    >
      <button
        type="button"
        aria-label="Close add service dialog"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => {
          if (!submitting) dismiss();
        }}
      />

      <div className="pointer-events-none relative z-[1] flex h-full max-h-[100dvh] items-end justify-center p-0 sm:items-center sm:p-5">
        <div className="pointer-events-auto relative z-[2] flex max-h-[min(92dvh,92svh)] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border border-border bg-background shadow-2xl sm:max-h-[min(88dvh,88svh)] sm:rounded-[2rem]">
          <div className="shrink-0 border-b border-border px-5 py-4 sm:px-6">
            <p className="text-[10px] uppercase tracking-[0.24em] text-accent">
              Add-on revenue
            </p>
            <h3
              id="add-member-addon-title"
              className="mt-2 font-serif text-2xl font-light text-foreground"
            >
              Add service & collect
            </h3>
            <p className="mt-2 text-sm text-muted">
              {row.customerName} · {row.planLabel}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
            {paymentUrl ? (
              <div className="space-y-5">
                <div className="rounded-3xl border border-emerald-300/25 bg-emerald-300/[0.07] p-5">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-200/75">
                    Secure link ready
                  </p>
                  <h4 className="mt-2 font-serif text-2xl text-foreground">
                    Customer approval comes first.
                  </h4>
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    {successMessage} Send this Stripe-hosted link to {row.customerName}.
                    HomeAtlas marks the service paid only after Stripe confirms the payment.
                  </p>
                </div>
                <label className="block">
                  <span className={craftLabel}>Customer payment link</span>
                  <textarea
                    readOnly
                    value={paymentUrl}
                    rows={4}
                    className={craftInput + " resize-none font-mono text-xs"}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => void copyPaymentUrl()}
                    className={craftSecondaryButton}
                  >
                    {copied ? "Copied" : "Copy payment link"}
                  </button>
                  <a
                    href={paymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-accent px-5 text-sm font-medium text-background"
                  >
                    Preview secure checkout
                  </a>
                </div>
                <p className="text-xs leading-relaxed text-muted/80">
                  For standing-authorized Jobber work, keep using the normal
                  scheduled-service billing lane. This link is for custom work
                  where the customer should review and approve the exact amount.
                </p>
              </div>
            ) : (
            <div className="space-y-5">
              <p className="text-sm leading-relaxed text-muted">
                Build any itemized service here. Create a customer-approved Stripe
                link, or save the line without collecting payment yet.
              </p>

              <div>
                <p className={craftLabel}>Quick service</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {QUICK_SERVICES.map((service) => (
                    <button
                      key={service.name}
                      type="button"
                      onClick={() => applyQuickService(service)}
                      className="rounded-full border border-border bg-surface/40 px-3 py-2 text-xs text-foreground/80 transition hover:border-accent/40 hover:text-accent"
                    >
                      {service.name} · {money(service.memberAmount)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className={craftLabel}>How to collect</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCollectionMode("stripe_checkout");
                      setStatus("quoted");
                    }}
                    aria-pressed={collectionMode === "stripe_checkout"}
                    className={`rounded-2xl border p-4 text-left transition ${
                      collectionMode === "stripe_checkout"
                        ? "border-accent/55 bg-accent/[0.08]"
                        : "border-border bg-surface/25"
                    }`}
                  >
                    <span className="block text-sm font-medium text-foreground">
                      Customer payment link
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted">
                      Recommended · customer approves the exact Stripe amount.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollectionMode("record_only")}
                    aria-pressed={collectionMode === "record_only"}
                    className={`rounded-2xl border p-4 text-left transition ${
                      collectionMode === "record_only"
                        ? "border-accent/55 bg-accent/[0.08]"
                        : "border-border bg-surface/25"
                    }`}
                  >
                    <span className="block text-sm font-medium text-foreground">
                      Record only
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted">
                      Saves scope and amount; does not touch the card.
                    </span>
                  </button>
                </div>
              </div>

              <label className="block">
                <span className={craftLabel}>Service name</span>
                <input
                  type="text"
                  value={serviceName}
                  onChange={(event) => setServiceName(event.target.value)}
                  placeholder="Moss Removal + Treatment"
                  className={craftInput}
                  required
                />
              </label>

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

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={craftLabel}>Retail price</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={retailPrice}
                    onChange={(event) => setRetailPrice(event.target.value)}
                    placeholder="375"
                    className={craftInput}
                    required
                  />
                </label>
                <label className="block">
                  <span className={craftLabel}>Member discount %</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={discountPercent}
                    onChange={(event) => setDiscountPercent(event.target.value)}
                    className={craftInput}
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="block">
                  <span className={craftLabel}>Amount charged</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amountCharged}
                    onChange={(event) => setAmountCharged(event.target.value)}
                    placeholder="300"
                    className={craftInput}
                    required
                  />
                </label>
                <button
                  type="button"
                  onClick={applySuggestedCharge}
                  className={`mb-0.5 ${craftSecondaryButton}`}
                >
                  Apply {discountPercent}% off
                </button>
              </div>

              {savingsPreview != null ? (
                <div className="rounded-2xl border border-border/70 bg-surface/30 px-4 py-3 text-sm text-foreground/80">
                  <p>Revenue: {money(chargedNumber || 0)}</p>
                  <p className="mt-1 text-muted">
                    Member savings: {money(savingsPreview)}
                  </p>
                </div>
              ) : null}

              {collectionMode === "record_only" ? (
                <label className="block">
                  <span className={craftLabel}>Status</span>
                  <select
                    value={status}
                    onChange={(event) =>
                      setStatus(event.target.value as MemberAddonStatus)
                    }
                    className={craftInput}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="rounded-2xl border border-sky-300/20 bg-sky-300/[0.05] px-4 py-3 text-xs leading-relaxed text-sky-100/75">
                  No saved card is charged here. Stripe Checkout collects the
                  customer&apos;s approval and payment, then the signed webhook updates HomeAtlas.
                </div>
              )}

              <label className="block">
                <span className={craftLabel}>Internal notes (optional)</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={2}
                  placeholder="Crew, scope, follow-up…"
                  className={craftInput + " resize-none"}
                />
              </label>
            </div>
            )}
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
                onClick={dismiss}
                disabled={submitting}
                className={`w-full sm:w-auto ${craftSecondaryButton}`}
              >
                {paymentUrl ? "Done" : "Cancel"}
              </button>
              {!paymentUrl ? <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={
                  submitting ||
                  !serviceName.trim() ||
                  !serviceDate ||
                  !retailPrice ||
                  !amountCharged
                }
                aria-busy={submitting}
                className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full border border-accent/40 bg-accent px-6 text-sm font-medium tracking-[0.08em] text-background shadow-[0_8px_24px_rgba(127,99,29,0.35)] transition hover:opacity-95 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
              >
                {submitting
                  ? "Saving…"
                  : collectionMode === "stripe_checkout"
                    ? "Create secure payment link"
                    : "Save service"}
              </button>
              : null}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
