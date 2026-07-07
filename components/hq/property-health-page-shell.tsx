"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { CustomerWorkspaceLink } from "@/components/admin/customer-workspace-link";
import { HQAssessmentTimeline } from "@/components/hq/HQAssessmentTimeline";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
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
      <div className="mx-auto min-h-screen max-w-3xl bg-[#0a0a0a] px-4 py-10 text-white">
        <p className="text-sm text-[#666]">Loading property memory…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto min-h-screen max-w-3xl bg-[#0a0a0a] px-4 py-10 text-white">
        <p className="text-sm text-red-400">{error ?? "Property not found."}</p>
      </div>
    );
  }

  const { property, assessments, legacyChecks } = data;
  const hasRecords = assessments.length > 0 || legacyChecks.length > 0;

  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-[#0a0a0a] px-4 py-10 text-white">
      <div className="mb-8">
        <p className="mb-1 text-[10px] uppercase tracking-widest text-[#444]">
          HQ · Property Memory
        </p>
        <h1 className="font-serif text-2xl text-white">
          {property?.address ?? "Property"}
        </h1>
        {property?.customerName ? (
          <p className="mt-0.5 text-sm text-[#444]">
            <CustomerWorkspaceLink
              type="property"
              id={propertyId}
              className="text-[#888] hover:text-[#c9a96e]"
            >
              {property.customerName}
            </CustomerWorkspaceLink>
          </p>
        ) : null}
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <Link
          href={`/hq/properties/${propertyId}/visit`}
          className="inline-block rounded-lg border border-[#c9a96e44] bg-[#c9a96e14] px-4 py-2 text-xs text-[#c9a96e] transition-colors hover:border-[#c9a96e]"
        >
          Document visit
        </Link>
        <Link
          href={`/hq/customers/property/${propertyId}`}
          className="inline-block rounded-lg border border-[#333] px-4 py-2 text-xs text-[#888] transition-colors hover:border-[#c9a96e] hover:text-[#c9a96e]"
        >
          Customer workspace
        </Link>
        <Link
          href={`/tech/properties/${propertyId}/assessment`}
          className="inline-block rounded-lg border border-[#333] px-4 py-2 text-xs text-[#888] transition-colors hover:border-[#c9a96e] hover:text-[#c9a96e]"
        >
          + Record Assessment
        </Link>
      </div>

      {hasRecords ? (
        <HQAssessmentTimeline
          assessments={assessments}
          legacyChecks={legacyChecks}
        />
      ) : (
        <div className="rounded-2xl bg-[#111] px-6 py-12 text-center">
          <p className="text-sm text-[#333]">
            No assessments recorded yet for this property.
          </p>
        </div>
      )}
    </div>
  );
}

export function PropertyHealthPageShell({ propertyId }: { propertyId: string }) {
  const [unlocked, setUnlocked] = useState(() => isAdminUnlocked());

  if (!unlocked) {
    return <AdminPinGate onUnlock={() => setUnlocked(true)} />;
  }

  return <PropertyHealthContent propertyId={propertyId} />;
}
