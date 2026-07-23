"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HomeCarePlanExperience } from "@/components/home-care-plan/experience";
import {
  LocalStorageFallbackNotice,
  LocalStorageNotice,
} from "@/components/persistence/local-storage-notice";
import type { HomeCarePlanData } from "@/lib/home-care-plan/types";

interface GeneratedHomeCarePlanClientProps {
  homeownerSlug: string;
  propertySlug: string;
  initialPlan: HomeCarePlanData | null;
  cloudPersistenceConnected: boolean;
  allowLocalFallback: boolean;
}

export function GeneratedHomeCarePlanClient({
  homeownerSlug,
  propertySlug,
  initialPlan,
  cloudPersistenceConnected,
  allowLocalFallback,
}: GeneratedHomeCarePlanClientProps) {
  const [localPlan, setLocalPlan] = useState<HomeCarePlanData | null>(null);
  const [localLoadComplete, setLocalLoadComplete] = useState(
    initialPlan !== null || !allowLocalFallback,
  );

  useEffect(() => {
    let cancelled = false;

    async function loadLocalFallback() {
      if (initialPlan || !allowLocalFallback) return;

      const { sessionStorageAdapter } = await import(
        "@/lib/persistence/adapters/session-storage"
      );
      const localRecord = await sessionStorageAdapter.getHomeCarePlanBySlugs(
        homeownerSlug,
        propertySlug,
      );

      if (cancelled) return;
      setLocalPlan(localRecord?.presentation ?? null);
      setLocalLoadComplete(true);
    }

    void loadLocalFallback();

    return () => {
      cancelled = true;
    };
  }, [allowLocalFallback, homeownerSlug, initialPlan, propertySlug]);

  const planData = initialPlan ?? localPlan;
  const loadedFromLocalFallback = !initialPlan && localPlan !== null;

  if (!localLoadComplete) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted">
        Loading your Home Care Plan…
      </div>
    );
  }

  if (!planData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <p className="font-serif text-3xl font-light text-foreground">
          Plan not found
        </p>
        <p className="mt-4 max-w-md text-sm text-muted">
          This presentation has not been generated yet, or your browser session
          has expired. Create a new plan from the employee dashboard.
        </p>
        <LocalStorageNotice variant="inline" className="mt-4 max-w-md" />
        <Link
          href="/employee/home-care-plan/create"
          className="mt-8 inline-flex min-h-[52px] items-center justify-center rounded-full bg-accent px-8 text-sm font-medium tracking-[0.12em] text-background"
        >
          Create Home Care Plan
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="fixed left-0 right-0 top-[var(--site-chrome-offset)] z-50 flex items-center justify-between gap-4 border-b border-border/60 bg-background/90 px-4 py-2 backdrop-blur-sm sm:px-6">
        {loadedFromLocalFallback ? (
          <div className="flex flex-wrap items-center gap-2">
            <LocalStorageFallbackNotice />
          </div>
        ) : cloudPersistenceConnected ? (
          <div className="flex flex-wrap items-center gap-2">
            <LocalStorageNotice variant="cloud" />
          </div>
        ) : (
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted">
            Flagship presentation
          </p>
        )}
        <Link
          href="/employee/home-care-plan/create"
          className="shrink-0 text-[10px] uppercase tracking-[0.2em] text-accent"
        >
          Edit in builder
        </Link>
      </div>
      <div className="pt-[var(--site-chrome-offset)]">
        <HomeCarePlanExperience data={planData} />
      </div>
    </>
  );
}
