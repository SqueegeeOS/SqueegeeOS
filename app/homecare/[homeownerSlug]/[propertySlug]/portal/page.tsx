"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MemberPortalExperience } from "@/components/membership/member-portal-experience";
import { MembershipUnlockProvider } from "@/components/membership/unlock-provider";
import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import { canyonOaksHomeCarePlan } from "@/lib/home-care-plan/canyon-oaks";
import type { HomeCarePlanData } from "@/lib/home-care-plan/types";
import { loadGeneratedHomeCarePlan } from "@/lib/persistence";

export default function MemberPortalPage() {
  const params = useParams<{
    homeownerSlug: string;
    propertySlug: string;
  }>();
  const [planData, setPlanData] = useState<HomeCarePlanData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
          setIsLoading(false);
          return;
        }
      }

      if (
        homeownerSlug === canyonOaksHomeCarePlan.homeowner.slug &&
        propertySlug === canyonOaksHomeCarePlan.property.slug
      ) {
        setPlanData(canyonOaksHomeCarePlan);
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
        Opening your portal…
      </div>
    );
  }

  if (!planData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <p className="font-serif text-3xl font-light text-foreground">
          Portal not found
        </p>
        <p className="mt-4 max-w-md text-sm text-muted">
          We could not find a membership portal for this property.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-[52px] items-center justify-center rounded-full bg-accent px-8 text-sm font-medium tracking-[0.12em] text-background"
        >
          Return home
        </Link>
      </div>
    );
  }

  return (
    <MembershipUnlockProvider>
      <MemberPortalExperience data={planData} />
    </MembershipUnlockProvider>
  );
}
