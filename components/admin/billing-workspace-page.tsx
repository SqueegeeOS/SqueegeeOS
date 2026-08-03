"use client";

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
import type { BillingWorkspaceData } from "@/lib/admin/billing-workspace-types";
import { isAdminUnlocked } from "@/lib/admin/pin";
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

function BillingWorkspaceContent() {
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
              />
            </GlassCard>
          </div>
        ) : null}
      </div>
    </AmbientStage>
  );
}

export function BillingWorkspacePage() {
  const [unlocked, setUnlocked] = useState(() => isAdminUnlocked());

  if (!unlocked) {
    return <AdminPinGate onUnlock={() => setUnlocked(true)} />;
  }

  return <BillingWorkspaceContent />;
}
