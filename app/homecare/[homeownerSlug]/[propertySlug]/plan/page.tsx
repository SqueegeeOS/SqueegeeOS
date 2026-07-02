"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { HomeCarePlanExperience } from "@/components/home-care-plan/experience";
import { LocalStorageNotice, LocalStorageFallbackNotice } from "@/components/persistence/local-storage-notice";
import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import { canyonOaksHomeCarePlan } from "@/lib/home-care-plan/canyon-oaks";
import type { HomeCarePlanData } from "@/lib/home-care-plan/types";
import { loadGeneratedHomeCarePlan } from "@/lib/persistence";

export default function GeneratedHomeCarePlanPage() {
  const params = useParams<{
    homeownerSlug: string;
    propertySlug: string;
  }>();
  const [planData, setPlanData] = useState<HomeCarePlanData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedFromLocalFallback, setLoadedFromLocalFallback] = useState(false);

  const homeownerSlug = params.homeownerSlug;
  const propertySlug = params.propertySlug;

  useEffect(() => {
    let cancelled = false;

    async function loadPlan() {
      if (isCloudPersistenceConnected()) {
        const { supabaseAdapter } = await import(
          "@/lib/persistence/adapters/supabase"
        );
        const { sessionStorageAdapter } = await import(
          "@/lib/persistence/adapters/session-storage"
        );

        const cloudRecord = await supabaseAdapter.getHomeCarePlanBySlugs(
          homeownerSlug,
          propertySlug,
        );

        if (cancelled) return;

        if (cloudRecord) {
          setPlanData(cloudRecord.presentation);
          setLoadedFromLocalFallback(false);
          setIsLoading(false);
          return;
        }

        const localRecord = await sessionStorageAdapter.getHomeCarePlanBySlugs(
          homeownerSlug,
          propertySlug,
        );

        if (cancelled) return;

        if (localRecord) {
          setPlanData(localRecord.presentation);
          setLoadedFromLocalFallback(true);
          setIsLoading(false);
          return;
        }
      } else {
        const stored = await loadGeneratedHomeCarePlan(
          homeownerSlug,
          propertySlug,
        );

        if (cancelled) return;

        if (stored) {
          setPlanData(stored);
          setLoadedFromLocalFallback(true);
          setIsLoading(false);
          return;
        }
      }

      if (
        homeownerSlug === canyonOaksHomeCarePlan.homeowner.slug &&
        propertySlug === canyonOaksHomeCarePlan.property.slug
      ) {
        setPlanData(canyonOaksHomeCarePlan);
        setLoadedFromLocalFallback(false);
      } else {
        setPlanData(null);
      }

      setIsLoading(false);
    }

    void loadPlan();

    return () => {
      cancelled = true;
    };
  }, [homeownerSlug, propertySlug]);

  if (isLoading) {
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
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between gap-4 border-b border-border/60 bg-background/90 px-4 py-2 backdrop-blur-sm sm:px-6">
        {loadedFromLocalFallback ? (
          <div className="flex flex-wrap items-center gap-2">
            <LocalStorageFallbackNotice />
          </div>
        ) : isCloudPersistenceConnected() ? (
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
      <div className="pt-10">
        <HomeCarePlanExperience data={planData} />
      </div>
    </>
  );
}
