"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { BillingOverview } from "@/components/admin/billing-overview";
import { BillingRegisterTable } from "@/components/admin/billing-register-table";
import {
  BillingAutomationPanel,
  type BillingAutomationControl,
} from "@/components/admin/billing-automation-panel";
import { HqFounderNav } from "@/components/admin/hq-founder-nav";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { GlassCard } from "@/components/craft/glass-card";
import { MotionReveal } from "@/components/craft/motion-reveal";
import { ShimmerBlock } from "@/components/motion/shimmer-block";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import {
  BILLING_PAYMENT_REVIEW_ANCHOR,
  billingMembershipAnchorId,
  type BillingWorkspaceFocus,
} from "@/lib/admin/billing-workspace-links";
import { formatBillingStatusLabel } from "@/lib/admin/billing-charge-dates";
import { formatCurrency } from "@/lib/admin/sales-calculations";
import type {
  BillingRegisterRow,
  BillingWorkspaceData,
} from "@/lib/admin/billing-workspace-types";
import { useAdminUnlockedState } from "@/lib/admin/use-admin-unlocked-state";
import { craftEyebrow, craftHeading } from "@/lib/craft/tokens";

function BillingLoadingShell() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-border/80 bg-background/40 p-5"
          >
            <ShimmerBlock className="h-3 w-24 rounded-full" />
            <ShimmerBlock className="mt-4 h-8 w-20 rounded-full" />
          </div>
        ))}
      </div>
      <GlassCard tone="subtle" padding="lg" motion="none">
        <ShimmerBlock className="h-4 w-48 rounded-full" />
        <ShimmerBlock className="mt-6 h-32 w-full rounded-2xl" />
      </GlassCard>
    </div>
  );
}

function paymentSetupSummary(row: BillingRegisterRow): string {
  switch (row.paymentSetupEmailState) {
    case "card_on_file":
      return row.cardOnFileLabel ?? "Stripe confirms a saved card.";
    case "ready":
      return `No card is saved. The secure Stripe email is ready${row.paymentSetupEmailRecipient ? ` for ${row.paymentSetupEmailRecipient}` : ""}.`;
    case "needs_email":
      return "No card is saved. Add a valid customer email before sending the secure Stripe link.";
    case "needs_agreement":
      return "No card is saved. The service agreement must be signed before the Stripe link unlocks.";
    case "needs_authorization_review":
      return "No card is saved. Review the signed billing authorization before sending the Stripe link.";
    default:
      return "No verified card-on-file action is currently available for this membership.";
  }
}

function BillingPaymentReview({
  focus,
  row,
}: {
  focus: BillingWorkspaceFocus;
  row: BillingRegisterRow | null;
}) {
  const exactAppointment = row?.nextAppointmentId === focus.appointmentId;
  const amount = row?.jobberScheduledAmount ?? row?.visitPrice ?? null;

  return (
    <section
      id={BILLING_PAYMENT_REVIEW_ANCHOR}
      className="scroll-mt-24"
    >
      <GlassCard
        tone="default"
        padding="lg"
        motion="rise"
        rim
        className="border border-accent/30 bg-accent/[0.055]"
      >
        <p className={craftEyebrow}>Exact Today handoff</p>
        <div className="mt-3 flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div>
            <h2 className="font-serif text-2xl font-light text-foreground sm:text-3xl">
              {row ? `Payment review · ${row.homeownerName}` : "Payment review unavailable"}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
              {row
                ? exactAppointment
                  ? "This is the same verified HomeAtlas appointment you opened from Today. Review its card, signed authority, Jobber amount, and billing state below."
                  : "HomeAtlas found the membership, but Billing’s next verified Jobber appointment is not the Today appointment you opened. Refresh Jobber before relying on this record."
                : "This membership is not in the active Billing register. Return to Today and verify the member, agreement, and Jobber pairing before taking payment action."}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-emerald-200/80">
              Opening this review never sends an email and never charges a card.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              href={focus.returnTo}
              className="inline-flex min-h-10 items-center rounded-full border border-border px-4 text-xs text-muted transition hover:border-foreground/30 hover:text-foreground"
            >
              Return to Today
            </Link>
            {row ? (
              <a
                href={`#${billingMembershipAnchorId(row.membershipId)}`}
                className="inline-flex min-h-10 items-center rounded-full border border-accent/35 bg-accent/10 px-4 text-xs text-accent transition hover:bg-accent/15"
              >
                Open exact billing row
              </a>
            ) : null}
          </div>
        </div>

        {row ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
                Visit identity
              </p>
              <p className={`mt-2 text-sm ${exactAppointment ? "text-emerald-200" : "text-amber-200"}`}>
                {exactAppointment ? "Exact appointment matched" : "Appointment mismatch"}
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
                Card readiness
              </p>
              <p className="mt-2 text-sm text-foreground">
                {paymentSetupSummary(row)}
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
                Verified amount
              </p>
              <p className="mt-2 text-sm text-foreground">
                {amount == null ? "Awaiting priced Jobber visit" : formatCurrency(amount)}
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
                Billing state
              </p>
              <p className="mt-2 text-sm text-foreground">
                {formatBillingStatusLabel(row.billingStatus)}
              </p>
            </div>
          </div>
        ) : null}
      </GlassCard>
    </section>
  );
}

function BillingWorkspaceContent({
  focus,
}: {
  focus: BillingWorkspaceFocus | null;
}) {
  const [data, setData] = useState<BillingWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [automation, setAutomation] = useState<BillingAutomationControl | null>(
    null,
  );
  const [automationError, setAutomationError] = useState<string | null>(null);

  const loadWorkspace = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    setAutomationError(null);
    try {
      const [workspaceResponse, automationResult] = await Promise.all([
        fetch("/api/admin/billing-workspace", {
          headers: getAdminRequestHeaders(),
          cache: "no-store",
        }),
        fetch("/api/admin/billing-automation", {
          headers: getAdminRequestHeaders(),
          cache: "no-store",
        })
          .then((response) => ({ response, error: null }))
          .catch((automationLoadError: unknown) => ({
            response: null,
            error: automationLoadError,
          })),
      ]);
      if (!workspaceResponse.ok) {
        const body = (await workspaceResponse.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to load billing workspace");
      }
      const workspace = (await workspaceResponse.json()) as BillingWorkspaceData;
      setData(workspace);
      const automationResponse = automationResult.response;
      if (automationResponse?.ok) {
        setAutomation(
          (await automationResponse.json()) as BillingAutomationControl,
        );
      } else {
        const automationBody = automationResponse
          ? ((await automationResponse.json().catch(() => null)) as {
              error?: string;
            } | null)
          : null;
        setAutomation(null);
        setAutomationError(
          automationBody?.error ??
            (automationResult.error instanceof Error
              ? automationResult.error.message
              : "Automatic-billing controls could not be loaded."),
        );
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load billing workspace",
      );
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void loadWorkspace(true);
    });
    return () => {
      active = false;
    };
  }, [loadWorkspace]);

  return (
    <AmbientStage className="px-4 py-10 text-foreground sm:px-6 sm:py-12">
      <div className="relative mx-auto max-w-7xl">
        <HqFounderNav />

        <MotionReveal className="mb-10 mt-10">
          <p className={craftEyebrow}>HomeAtlas operations</p>
          <h1 className={`${craftHeading} mt-3 text-3xl sm:text-4xl`}>
            Billing
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-[1.65] text-muted">
            Complete scheduled care, review every service and savings amount,
            then charge the member&apos;s saved card through one recoverable
            HomeAtlas operation. Manual Stripe recording remains available as
            a fallback.
          </p>
        </MotionReveal>

        {loading ? (
          <BillingLoadingShell />
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : data ? (
          <div className="space-y-8">
            {focus ? (
              <BillingPaymentReview
                focus={focus}
                row={
                  data.rows.find(
                    (row) => row.membershipId === focus.membershipId,
                  ) ?? null
                }
              />
            ) : null}
            <BillingOverview overview={data.overview} />

            {automation ? (
              <BillingAutomationPanel
                control={automation}
                onUpdated={() => loadWorkspace(false)}
              />
            ) : automationError ? (
              <GlassCard
                tone="subtle"
                padding="lg"
                motion="rise"
                className="border border-red-400/30 bg-red-400/[0.06]"
              >
                <p className={craftEyebrow}>Automation unavailable</p>
                <h2 className="mt-2 font-serif text-2xl font-light text-foreground">
                  Billing controls did not load
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-red-200">
                  {automationError} No preview, retry, or automation change is
                  available from this page until the controls reload.
                </p>
                <button
                  type="button"
                  onClick={() => void loadWorkspace(true)}
                  className="mt-4 rounded-full border border-red-300/35 px-5 py-2.5 text-xs uppercase tracking-[0.14em] text-red-100 transition hover:bg-red-300/10"
                >
                  Reload billing controls
                </button>
              </GlassCard>
            ) : null}

            <GlassCard tone="subtle" padding="lg" motion="rise">
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className={craftEyebrow}>Billing register</p>
                  <h2 className="mt-2 font-serif text-2xl font-light text-foreground">
                    Active memberships
                  </h2>
                </div>
                <p className="text-xs text-muted">
                  Updated{" "}
                  {new Date(data.loadedAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <BillingRegisterTable
                rows={data.rows}
                stripeDashboardLive={data.stripeDashboardLive}
                onRecorded={() => void loadWorkspace(false)}
                focusedMembershipId={focus?.membershipId ?? null}
              />
            </GlassCard>
          </div>
        ) : null}
      </div>
    </AmbientStage>
  );
}

export function BillingWorkspacePage({
  focus = null,
}: {
  focus?: BillingWorkspaceFocus | null;
}) {
  const [unlocked, setUnlocked] = useAdminUnlockedState();

  if (!unlocked) {
    return <AdminPinGate onUnlock={() => setUnlocked(true)} />;
  }

  return <BillingWorkspaceContent focus={focus} />;
}
