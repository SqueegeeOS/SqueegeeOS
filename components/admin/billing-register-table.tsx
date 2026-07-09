"use client";

import { useState } from "react";
import Link from "next/link";
import {
  formatBillingStatusLabel,
} from "@/lib/admin/billing-charge-dates";
import { formatCurrency } from "@/lib/admin/sales-calculations";
import type {
  BillingRegisterRow,
  BillingStatus,
  StripePaymentStatus,
} from "@/lib/admin/billing-workspace-types";
import { CustomerWorkspaceLink } from "@/components/admin/customer-workspace-link";
import { RecordManualChargeModal } from "@/components/admin/record-manual-charge-modal";
import { craftEyebrow, craftTableHead } from "@/lib/craft/tokens";
import { customerWorkspaceHref } from "@/lib/hq/customer-workspace/routes";

function stripeDashboardCustomerUrl(
  customerId: string,
  live: boolean,
): string {
  const prefix = live ? "" : "/test";
  return `https://dashboard.stripe.com${prefix}/customers/${customerId}`;
}

function formatStripePaymentStatus(status: StripePaymentStatus): string {
  switch (status) {
    case "card_on_file":
      return "Card on file";
    case "customer_only":
      return "Stripe customer";
    case "payment_pending":
      return "Payment pending";
    case "not_configured":
      return "Not configured";
    default:
      return status;
  }
}

function billingStatusTone(status: BillingStatus): string {
  switch (status) {
    case "ready_to_charge":
      return "border-accent/35 bg-accent/10 text-accent";
    case "charged":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    case "failed":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    case "upcoming":
      return "border-border/50 bg-foreground/[0.04] text-muted";
    case "inactive":
      return "border-border/40 bg-foreground/[0.02] text-muted/80";
    default:
      return "border-border/40 text-muted";
  }
}

function formatChargeDate(isoDate: string | null): string {
  if (!isoDate) return "—";
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function RowAction({
  label,
  onClick,
  href,
  disabled,
  external,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  external?: boolean;
}) {
  const className =
    "inline-flex items-center rounded-full border border-border/40 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-muted transition hover:border-border hover:text-foreground disabled:pointer-events-none disabled:opacity-40";

  if (href && !disabled) {
    if (external) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
        >
          {label}
        </a>
      );
    }
    return (
      <Link href={href} className={className}>
        {label}
      </Link>
    );
  }

  if (href && disabled) {
    return (
      <span className={className} aria-disabled>
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {label}
    </button>
  );
}

function BillingRegisterRowActions({
  row,
  stripeDashboardLive,
  onRecordCharge,
}: {
  row: BillingRegisterRow;
  stripeDashboardLive: boolean;
  onRecordCharge: (row: BillingRegisterRow) => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyCustomerId = async () => {
    if (!row.stripeCustomerId) return;
    try {
      await navigator.clipboard.writeText(row.stripeCustomerId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  const stripeUrl = row.stripeCustomerId
    ? stripeDashboardCustomerUrl(row.stripeCustomerId, stripeDashboardLive)
    : null;

  return (
    <div className="flex flex-wrap gap-2">
      <RowAction
        label="Open customer"
        href={customerWorkspaceHref("property", row.propertyId)}
      />
      <RowAction
        label="Open in Stripe"
        href={stripeUrl ?? undefined}
        disabled={!stripeUrl}
        external
      />
      <RowAction
        label={copied ? "Copied" : "Copy Stripe ID"}
        onClick={() => void copyCustomerId()}
        disabled={!row.stripeCustomerId}
      />
      {row.agreementPdfUrl ? (
        <RowAction
          label="View agreement"
          href={row.agreementPdfUrl}
          external
        />
      ) : (
        <RowAction label="View agreement" disabled />
      )}
      <RowAction
        label="View property"
        href={customerWorkspaceHref("property", row.propertyId)}
      />
      <RowAction
        label="Record manual charge"
        onClick={() => onRecordCharge(row)}
        disabled={!row.canRecordCharge}
      />
      {row.chargeAction === "manual_charge" ? (
        <RowAction
          label="Manual charge"
          href={stripeUrl ?? undefined}
          disabled={!stripeUrl || row.billingStatus === "inactive"}
          external
        />
      ) : null}
    </div>
  );
}

export function BillingRegisterTable({
  rows,
  stripeDashboardLive,
  onRecorded,
}: {
  rows: BillingRegisterRow[];
  stripeDashboardLive: boolean;
  onRecorded: () => void;
}) {
  const [recordingRow, setRecordingRow] = useState<BillingRegisterRow | null>(
    null,
  );

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted">
        No active memberships yet. When members enroll with a card on file, they
        appear here for monthly billing operations.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {recordingRow ? (
        <RecordManualChargeModal
          row={recordingRow}
          onClose={() => setRecordingRow(null)}
          onRecorded={onRecorded}
        />
      ) : null}
      <p className={craftEyebrow}>
        {rows.length} membership{rows.length === 1 ? "" : "s"}
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className={`border-b border-border/70 ${craftTableHead}`}>
              <th className="pb-3 pr-4 font-medium">Homeowner</th>
              <th className="pb-3 pr-4 font-medium">Property</th>
              <th className="pb-3 pr-4 font-medium">Tier</th>
              <th className="pb-3 pr-4 font-medium">Visit price</th>
              <th className="pb-3 pr-4 font-medium">Stripe</th>
              <th className="pb-3 pr-4 font-medium">Card on file</th>
              <th className="pb-3 pr-4 font-medium">Next charge</th>
              <th className="pb-3 pr-4 font-medium">Last charge</th>
              <th className="pb-3 pr-4 font-medium">Status</th>
              <th className="pb-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.membershipId}
                className="border-b border-border/40 align-top"
              >
                <td className="py-4 pr-4">
                  <CustomerWorkspaceLink type="property" id={row.propertyId}>
                    {row.homeownerName}
                  </CustomerWorkspaceLink>
                </td>
                <td className="py-4 pr-4 text-muted">{row.propertyLabel}</td>
                <td className="py-4 pr-4">{row.tierLabel}</td>
                <td className="py-4 pr-4 tabular-nums">
                  {row.visitPrice != null
                    ? formatCurrency(row.visitPrice)
                    : "—"}
                </td>
                <td className="py-4 pr-4 text-muted">
                  {formatStripePaymentStatus(row.stripePaymentStatus)}
                </td>
                <td className="py-4 pr-4">
                  {row.cardOnFileLabel ??
                    (row.stripePaymentStatus === "card_on_file"
                      ? "Card on file"
                      : "—")}
                </td>
                <td className="py-4 pr-4 tabular-nums text-foreground">
                  {formatChargeDate(row.nextChargeDate)}
                </td>
                <td className="py-4 pr-4 tabular-nums text-muted">
                  {formatChargeDate(row.lastChargeDate)}
                </td>
                <td className="py-4 pr-4">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${billingStatusTone(row.billingStatus)}`}
                  >
                    {formatBillingStatusLabel(row.billingStatus)}
                  </span>
                </td>
                <td className="py-4">
                  <BillingRegisterRowActions
                    row={row}
                    stripeDashboardLive={stripeDashboardLive}
                    onRecordCharge={setRecordingRow}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
