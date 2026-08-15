"use client";

import { useState } from "react";
import Link from "next/link";
import { formatBillingStatusLabel } from "@/lib/admin/billing-charge-dates";
import { formatCurrency } from "@/lib/admin/sales-calculations";
import type {
  BillingRegisterRow,
  BillingStatus,
  StripePaymentStatus,
} from "@/lib/admin/billing-workspace-types";
import { CustomerWorkspaceLink } from "@/components/admin/customer-workspace-link";
import { craftEyebrow, craftTableHead } from "@/lib/craft/tokens";
import { customerWorkspaceHref } from "@/lib/hq/customer-workspace/routes";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { billingMembershipAnchorId } from "@/lib/admin/billing-workspace-links";

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

function customerBankApprovalRequired(row: BillingRegisterRow): boolean {
  if (row.billingExecutionState !== "needs_action") return false;
  const code = row.billingFailureCode?.toLowerCase() ?? "";
  const message = row.billingFailureMessage?.toLowerCase() ?? "";
  return (
    code === "stripe_requires_action" ||
    code === "requires_action" ||
    code === "authentication_required" ||
    message.includes("requires_action") ||
    message.includes("authentication required")
  );
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
  onUpdated,
}: {
  row: BillingRegisterRow;
  stripeDashboardLive: boolean;
  onUpdated: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeIsError, setNoticeIsError] = useState(false);

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
  const bankApprovalRequired = customerBankApprovalRequired(row);

  const setAutomaticBilling = async (enabled: boolean) => {
    const confirmed = window.confirm(
      enabled
        ? `Resume automatic billing for ${row.homeownerName}? Atlas will only charge after every signed-price, Jobber membership-job, saved-card, and duplicate-payment check passes.`
        : `Pause automatic billing for ${row.homeownerName}? Any unstarted queued order for this member will be voided.`,
    );
    if (!confirmed) {
      return;
    }
    setWorking(true);
    setNotice(null);
    setNoticeIsError(false);
    try {
      const response = await fetch("/api/admin/billing-automation", {
        method: "PATCH",
        headers: {
          ...getAdminRequestHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "membership",
          membershipId: row.membershipId,
          enabled,
          reason: "Founder changed this member from the billing register",
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) throw new Error(body?.error ?? "Update failed");
      setNotice(
        enabled
          ? "Member auto-bill is eligible when the global switch is armed"
          : "Member auto-bill paused and unstarted orders voided",
      );
      onUpdated();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Update failed");
      setNoticeIsError(true);
    } finally {
      setWorking(false);
    }
  };

  const verifyBillingAuthorization = async () => {
    if (!row.agreementPdfUrl || row.visitPrice == null) return;
    const agreementWindow = window.open(row.agreementPdfUrl, "_blank");
    if (!agreementWindow) {
      setNotice(
        "Your browser blocked the signed agreement. Open it with View agreement, then try again.",
      );
      setNoticeIsError(true);
      return;
    }
    agreementWindow.opener = null;
    if (
      !window.confirm(
        `Review the signed PDF that just opened. Does it authorize saving the payment method and charging the variable Jobber price of all scheduled services on the 1st of each service month? The signed base membership visit price is ${formatCurrency(row.visitPrice)}.`,
      )
    ) {
      return;
    }
    setWorking(true);
    setNotice(null);
    setNoticeIsError(false);
    try {
      const response = await fetch("/api/admin/billing-automation", {
        method: "PATCH",
        headers: {
          ...getAdminRequestHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "authorize_membership",
          membershipId: row.membershipId,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Authorization review failed");
      }
      setNotice("Signed billing authorization recorded");
      onUpdated();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Authorization review failed",
      );
      setNoticeIsError(true);
    } finally {
      setWorking(false);
    }
  };

  const retryCharge = async () => {
    if (!row.billingOrderId) return;
    if (
      !window.confirm(
        "Retry this exact locked service-month charge now? Use this only after the member updates or approves their saved card.",
      )
    ) {
      return;
    }
    setWorking(true);
    setNotice(null);
    setNoticeIsError(false);
    try {
      const response = await fetch("/api/admin/billing-automation", {
        method: "POST",
        headers: {
          ...getAdminRequestHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "retry",
          billingOrderId: row.billingOrderId,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        run?: { paid?: number; needsAction?: number; failed?: number };
      } | null;
      if (!response.ok) throw new Error(body?.error ?? "Retry failed");
      setNotice(
        body?.run?.paid
          ? "Payment succeeded"
          : body?.run?.needsAction
            ? "Card still needs customer action"
            : body?.run?.failed
              ? "Retry failed; review the order status"
              : "No charge was attempted",
      );
      onUpdated();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Retry failed");
      setNoticeIsError(true);
    } finally {
      setWorking(false);
    }
  };

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
        label={
          row.automaticBillingEnabled ? "Pause auto-bill" : "Resume auto-bill"
        }
        onClick={() => void setAutomaticBilling(!row.automaticBillingEnabled)}
        disabled={
          working ||
          (!row.automaticBillingEnabled && !row.billingAuthorizationReady)
        }
      />
      {!row.billingAuthorizationReady ? (
        <RowAction
          label="Open + verify signed terms"
          onClick={() => void verifyBillingAuthorization()}
          disabled={working || !row.agreementPdfUrl || row.visitPrice == null}
        />
      ) : null}
      {row.billingStatus === "failed" &&
      row.billingOrderId &&
      !bankApprovalRequired &&
      ["failed_retryable", "needs_action", "permanently_failed"].includes(
        row.billingExecutionState ?? "",
      ) ? (
        <RowAction
          label="Retry exact charge"
          onClick={() => void retryCharge()}
          disabled={working}
        />
      ) : null}
      {bankApprovalRequired ? (
        <RowAction label="Customer approval required" disabled />
      ) : null}
      {notice ? (
        <span
          className={`self-center text-[11px] ${noticeIsError ? "text-red-300" : "text-muted"}`}
          role={noticeIsError ? "alert" : "status"}
        >
          {notice}
        </span>
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
              <th className="pb-3 pr-4 font-medium">Base visit</th>
              <th className="pb-3 pr-4 font-medium">Next Jobber charge</th>
              <th className="pb-3 pr-4 font-medium">Stripe</th>
              <th className="pb-3 pr-4 font-medium">Card on file</th>
              <th className="pb-3 pr-4 font-medium">Service-month charge</th>
              <th className="pb-3 pr-4 font-medium">Last charge</th>
              <th className="pb-3 pr-4 font-medium">Status</th>
              <th className="pb-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.membershipId}
                id={billingMembershipAnchorId(row.membershipId)}
                className="scroll-mt-24 border-b border-border/40 align-top target:bg-accent/[0.06] target:outline target:outline-1 target:outline-accent/40"
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
                <td className="py-4 pr-4 tabular-nums font-medium text-foreground">
                  {row.jobberScheduledAmount != null
                    ? formatCurrency(row.jobberScheduledAmount)
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
                  {!row.billingAuthorizationReady ? (
                    <p className="mt-2 max-w-56 text-[11px] leading-relaxed text-amber-200">
                      Signed automatic-billing terms need founder verification.
                    </p>
                  ) : null}
                  {!row.jobberPropertyPaired ? (
                    <p className="mt-2 max-w-56 text-[11px] leading-relaxed text-amber-200">
                      Pair this HomeAtlas property to its Jobber property before
                      a scheduled service can qualify for billing.
                    </p>
                  ) : !row.verifiedServiceVisitReady ? (
                    <p className="mt-2 max-w-56 text-[11px] leading-relaxed text-muted">
                      Property paired; no priced, unbilled upcoming Jobber
                      service is ready yet.
                    </p>
                  ) : null}
                  {row.billingExecutionState ? (
                    <p className="mt-2 max-w-52 text-[11px] leading-relaxed text-muted">
                      {row.billingExecutionState.replaceAll("_", " ")}
                      {row.billingAttemptCount > 0
                        ? ` · ${row.billingAttemptCount} attempt${row.billingAttemptCount === 1 ? "" : "s"}`
                        : ""}
                    </p>
                  ) : null}
                  {row.billingFailureMessage ? (
                    <p className="mt-1 max-w-56 text-[11px] leading-relaxed text-red-300">
                      {row.billingFailureMessage}
                    </p>
                  ) : null}
                  {customerBankApprovalRequired(row) ? (
                    <p className="mt-1 max-w-56 text-[11px] leading-relaxed text-amber-200">
                      Customer bank approval is required. Handle this in Stripe
                      or contact the customer; Atlas will not retry it
                      automatically.
                    </p>
                  ) : null}
                  {row.billingNextAttemptAt ? (
                    <p className="mt-1 max-w-56 text-[11px] leading-relaxed text-muted">
                      Next provider retry {new Date(row.billingNextAttemptAt).toLocaleString()}
                    </p>
                  ) : null}
                </td>
                <td className="py-4">
                  <BillingRegisterRowActions
                    row={row}
                    stripeDashboardLive={stripeDashboardLive}
                    onUpdated={onRecorded}
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
