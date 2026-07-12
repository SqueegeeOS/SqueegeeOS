"use client";

import Link from "next/link";
import { useState } from "react";
import { CustomerWorkspaceLink } from "@/components/admin/customer-workspace-link";
import { MembershipHealthBadgeList } from "@/components/admin/membership-health-badge";
import type { MembershipMemberRow } from "@/lib/admin/membership-command-center-types";
import { formatCurrency } from "@/lib/admin/sales-calculations";
import type { StripePaymentStatus } from "@/lib/admin/billing-workspace-types";
import { craftEyebrow, craftTableHead } from "@/lib/craft/tokens";
import { customerWorkspaceHref } from "@/lib/hq/customer-workspace/routes";

function formatPaymentStatus(status: StripePaymentStatus, cardLabel: string | null): string {
  if (cardLabel) return cardLabel;
  switch (status) {
    case "card_on_file":
      return "Card on file";
    case "customer_only":
      return "Stripe customer only";
    case "payment_pending":
      return "Payment pending";
    case "not_configured":
      return "Not configured";
    default:
      return status;
  }
}

function formatPendingReason(reason: MembershipMemberRow["pendingReason"]): string {
  switch (reason) {
    case "signed_missing_card":
      return "Signed · missing card";
    case "card_not_active":
      return "Card added · not active";
    case "agreement_not_signed":
      return "Agreement not signed";
    default:
      return "Pending";
  }
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

function MemberRowActions({ row }: { row: MembershipMemberRow }) {
  const [copied, setCopied] = useState(false);

  const copyPortalLink = async () => {
    if (!row.portalUrl) return;
    const absolute =
      row.portalUrl.startsWith("http")
        ? row.portalUrl
        : `${window.location.origin}${row.portalUrl}`;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  const workspaceHref = row.propertyId
    ? customerWorkspaceHref("property", row.propertyId)
    : row.presentationId
      ? customerWorkspaceHref("presentation", row.presentationId)
      : null;

  return (
    <div className="flex flex-wrap gap-2">
      <RowAction
        label="Open portal"
        href={row.portalUrl ?? undefined}
        disabled={!row.portalUrl}
        external={Boolean(row.portalUrl?.startsWith("http"))}
      />
      <RowAction
        label="Open property"
        href={workspaceHref ?? undefined}
        disabled={!workspaceHref}
      />
      <RowAction
        label="Member record"
        href={workspaceHref ?? undefined}
        disabled={!workspaceHref}
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
        label={copied ? "Copied" : "Copy portal link"}
        onClick={() => void copyPortalLink()}
        disabled={!row.portalUrl}
      />
    </div>
  );
}

export function MembershipMemberTable({
  rows,
  variant,
}: {
  rows: MembershipMemberRow[];
  variant: "active" | "pending";
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted">
        {variant === "active"
          ? "No active members yet. Members appear here once agreement is signed and a card is on file."
          : "No pending members. Agreement or payment gaps will show here."}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className={craftEyebrow}>
        {rows.length} {variant === "active" ? "active" : "pending"} member
        {rows.length === 1 ? "" : "s"}
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className={`border-b border-border/70 ${craftTableHead}`}>
              <th className="pb-3 pr-4 font-medium">Customer</th>
              <th className="pb-3 pr-4 font-medium">Property</th>
              <th className="pb-3 pr-4 font-medium">Plan</th>
              <th className="pb-3 pr-4 font-medium">Visit price</th>
              <th className="pb-3 pr-4 font-medium">Yearly value</th>
              <th className="pb-3 pr-4 font-medium">Next service</th>
              <th className="pb-3 pr-4 font-medium">Payment</th>
              {variant === "pending" ? (
                <th className="pb-3 pr-4 font-medium">Status</th>
              ) : null}
              <th className="pb-3 pr-4 font-medium">Health</th>
              <th className="pb-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.membershipId ?? row.presentationId ?? row.homeownerId}-${variant}`}
                className="border-b border-border/40 align-top"
              >
                <td className="py-4 pr-4">
                  {row.propertyId ? (
                    <CustomerWorkspaceLink type="property" id={row.propertyId}>
                      {row.homeownerName}
                    </CustomerWorkspaceLink>
                  ) : row.presentationId ? (
                    <CustomerWorkspaceLink
                      type="presentation"
                      id={row.presentationId}
                    >
                      {row.homeownerName}
                    </CustomerWorkspaceLink>
                  ) : (
                    row.homeownerName
                  )}
                  {row.foundingMember ? (
                    <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-accent">
                      Founding member
                    </p>
                  ) : null}
                </td>
                <td className="py-4 pr-4 text-muted">{row.propertyLabel}</td>
                <td className="py-4 pr-4">{row.planType}</td>
                <td className="py-4 pr-4 tabular-nums">
                  {row.visitPrice != null ? formatCurrency(row.visitPrice) : "—"}
                </td>
                <td className="py-4 pr-4 tabular-nums">
                  {row.yearlyValue != null
                    ? formatCurrency(row.yearlyValue)
                    : "—"}
                </td>
                <td className="py-4 pr-4 text-muted">
                  {row.nextServiceLabel ?? "—"}
                </td>
                <td className="py-4 pr-4 text-muted">
                  {formatPaymentStatus(row.paymentStatus, row.cardLabel)}
                </td>
                {variant === "pending" ? (
                  <td className="py-4 pr-4 text-muted">
                    {formatPendingReason(row.pendingReason)}
                  </td>
                ) : null}
                <td className="py-4 pr-4">
                  <MembershipHealthBadgeList badges={row.healthBadges} />
                  {row.missingFlags.length > 0 ? (
                    <ul className="mt-2 space-y-0.5 text-[11px] text-muted">
                      {row.missingFlags.map((flag) => (
                        <li key={flag}>· {flag}</li>
                      ))}
                    </ul>
                  ) : null}
                </td>
                <td className="py-4">
                  <MemberRowActions row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
