"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { GlassCard } from "@/components/craft/glass-card";
import { MotionReveal } from "@/components/craft/motion-reveal";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { CustomerWorkspaceLink } from "@/components/admin/customer-workspace-link";
import { HQAssessmentTimeline } from "@/components/hq/HQAssessmentTimeline";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { craftEyebrow, craftHeading, craftSecondaryButton } from "@/lib/craft/tokens";
import { isAdminUnlocked } from "@/lib/admin/pin";
import type { PropertyAssessment } from "@/lib/health/assessment-types";
import type { PropertyHealthHeader } from "@/lib/health/repository";
import type { PropertyHealthCheck } from "@/lib/health/types";

interface PropertyHealthPayload {
  property: PropertyHealthHeader | null;
  assessments: PropertyAssessment[];
  legacyChecks: PropertyHealthCheck[];
}

function PropertyHealthContent({ propertyId }: { propertyId: string }) {
  const [data, setData] = useState<PropertyHealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/property-health/${propertyId}`, {
        headers: getAdminRequestHeaders(),
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(
          response.status === 401 ? "Unauthorized" : "Failed to load property health",
        );
      }
      setData((await response.json()) as PropertyHealthPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load property health");
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-14">
        <p className="text-sm text-muted">Loading property memory…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-14">
        <p className="text-sm text-red-400">{error ?? "Property not found."}</p>
      </div>
    );
  }

  const { property, assessments, legacyChecks } = data;
  const hasRecords = assessments.length > 0 || legacyChecks.length > 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:py-14">
      <MotionReveal className="mb-10">
        <p className={craftEyebrow}>HQ · Property Memory</p>
        <h1 className={`${craftHeading} mt-3 text-2xl sm:text-3xl`}>
          {property?.address ?? "Property"}
        </h1>
        {property?.customerName ? (
          <p className="mt-2 text-sm text-muted">
            <CustomerWorkspaceLink
              type="property"
              id={propertyId}
              className="transition-colors hover:text-accent"
            >
              {property.customerName}
            </CustomerWorkspaceLink>
          </p>
        ) : null}
      </MotionReveal>

      <MotionReveal index={1} className="mb-10 flex flex-wrap items-center gap-2.5">
        <Link
          href={`/hq/properties/${propertyId}/visit`}
          className={`${craftSecondaryButton} !min-h-[40px] !px-4 !text-[10px] !tracking-[0.16em] border-accent/25 bg-accent/10 text-accent hover:border-accent/40`}
        >
          Document visit
        </Link>
        <Link
          href={`/hq/customers/property/${propertyId}`}
          className={`${craftSecondaryButton} !min-h-[40px] !px-4 !text-[10px] !tracking-[0.16em]`}
        >
          Customer workspace
        </Link>
        <Link
          href={`/tech/properties/${propertyId}/assessment`}
          className={`${craftSecondaryButton} !min-h-[40px] !px-4 !text-[10px] !tracking-[0.16em]`}
        >
          + Record Assessment
        </Link>
      </MotionReveal>

      {hasRecords ? (
        <HQAssessmentTimeline
          assessments={assessments}
          legacyChecks={legacyChecks}
        />
      ) : (
        <GlassCard tone="subtle" motion="rise" className="px-6 py-14 text-center">
          <p className="text-sm text-muted">
            No assessments recorded yet for this property.
          </p>
        </GlassCard>
      )}
    </div>
  );
}

export function PropertyHealthPageShell({ propertyId }: { propertyId: string }) {
  const [unlocked, setUnlocked] = useState(() => isAdminUnlocked());

  if (!unlocked) {
    return <AdminPinGate onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <AmbientStage className="text-white">
      <PropertyHealthContent propertyId={propertyId} />
    </AmbientStage>
  );
}
