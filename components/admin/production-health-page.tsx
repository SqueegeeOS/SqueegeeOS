"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { HqFounderNav } from "@/components/admin/hq-founder-nav";
import { ProductionHealthDashboard } from "@/components/admin/production-health-dashboard";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { MotionReveal } from "@/components/craft/motion-reveal";
import { ShimmerBlock } from "@/components/motion/shimmer-block";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import type { ProductionHealthReport } from "@/lib/admin/production-health-types";
import { isAdminUnlocked } from "@/lib/admin/pin";
import { craftEyebrow, craftHeading, craftPrimaryButton } from "@/lib/craft/tokens";

function ProductionHealthLoadingShell() {
  return (
    <div className="space-y-4">
      <ShimmerBlock className="h-36 w-full rounded-2xl" />
      <ShimmerBlock className="h-48 w-full rounded-2xl" />
      <ShimmerBlock className="h-48 w-full rounded-2xl" />
    </div>
  );
}

function ProductionHealthContent() {
  const [report, setReport] = useState<ProductionHealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/production-health", {
        headers: getAdminRequestHeaders(),
        cache: "no-store",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to load production health");
      }
      setReport((await response.json()) as ProductionHealthReport);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load production health",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  return (
    <AmbientStage className="px-4 py-10 text-foreground sm:px-6 sm:py-12">
      <div className="relative mx-auto max-w-5xl">
        <HqFounderNav />

        <MotionReveal className="mb-8 mt-10">
          <p className={craftEyebrow}>HomeAtlas operations</p>
          <h1 className={`${craftHeading} mt-3 text-3xl sm:text-4xl`}>
            Production Health
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-[1.65] text-muted">
            Read-only checks for migrations, Stripe, storage, agreement signing,
            billing readiness, and live customer data integrity. Run this before
            onboarding Customer #2.
          </p>
        </MotionReveal>

        <div className="mb-6">
          <button
            type="button"
            onClick={() => void loadReport()}
            disabled={loading}
            className={craftPrimaryButton}
          >
            {loading ? "Checking…" : "Run checks again"}
          </button>
        </div>

        {loading ? (
          <ProductionHealthLoadingShell />
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : report ? (
          <ProductionHealthDashboard report={report} />
        ) : null}
      </div>
    </AmbientStage>
  );
}

export function ProductionHealthPage() {
  const [unlocked, setUnlocked] = useState(() => isAdminUnlocked());

  if (!unlocked) {
    return <AdminPinGate onUnlock={() => setUnlocked(true)} />;
  }

  return <ProductionHealthContent />;
}
