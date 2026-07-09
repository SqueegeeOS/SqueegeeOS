"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { BillingOverview } from "@/components/admin/billing-overview";
import { BillingRegisterTable } from "@/components/admin/billing-register-table";
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

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/billing-workspace", {
        headers: getAdminRequestHeaders(),
        cache: "no-store",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to load billing workspace");
      }
      const workspace = (await response.json()) as BillingWorkspaceData;
      setData(workspace);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load billing workspace",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
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
            Operational dashboard for collecting visit payments on the 1st of
            each service month. Charges run manually in Stripe today — this
            workspace prepares HomeAtlas for saved-card billing later.
          </p>
        </MotionReveal>

        {loading ? (
          <BillingLoadingShell />
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : data ? (
          <div className="space-y-8">
            <BillingOverview overview={data.overview} />

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
