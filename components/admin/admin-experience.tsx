"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminCommandCenter } from "@/components/admin/admin-command-center";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { FounderOnboarding } from "@/components/admin/founder-onboarding";
import {
  syncHeadquartersProfile,
  type HeadquartersSyncResult,
} from "@/lib/admin/headquarters-profile-client";
import {
  isFounderOnboardingComplete,
  loadLegacyBaseline,
  type LegacyBaseline,
} from "@/lib/admin/legacy-baseline";
import { isAdminUnlocked } from "@/lib/admin/pin";

export function AdminExperience() {
  const [unlocked, setUnlocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [legacyBaseline, setLegacyBaseline] =
    useState<LegacyBaseline | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [syncResult, setSyncResult] = useState<HeadquartersSyncResult | null>(
    null,
  );

  const applySyncResult = useCallback((result: HeadquartersSyncResult) => {
    setLegacyBaseline(result.baseline);
    setOnboardingComplete(result.baseline.onboardingComplete);
    setSyncResult(result);
  }, []);

  const runCloudSync = useCallback(async () => {
    const result = await syncHeadquartersProfile();
    applySyncResult(result);
    return result;
  }, [applySyncResult]);

  useEffect(() => {
    const initiallyUnlocked = isAdminUnlocked();
    setUnlocked(initiallyUnlocked);

    if (initiallyUnlocked) {
      void runCloudSync().finally(() => setReady(true));
      return;
    }

    setLegacyBaseline(loadLegacyBaseline());
    setOnboardingComplete(isFounderOnboardingComplete());
    setReady(true);
  }, [runCloudSync]);

  const handleUnlock = useCallback(() => {
    setUnlocked(true);
    setReady(false);
    void runCloudSync().finally(() => setReady(true));
  }, [runCloudSync]);

  const handleOnboardingComplete = useCallback(
    (baseline: LegacyBaseline, sync?: HeadquartersSyncResult) => {
      setLegacyBaseline(baseline);
      setOnboardingComplete(true);
      if (sync) {
        setSyncResult(sync);
      }
    },
    [],
  );

  if (!ready) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-background text-muted">
        Preparing headquarters…
      </div>
    );
  }

  if (!unlocked) {
    return <AdminPinGate onUnlock={handleUnlock} />;
  }

  if (!onboardingComplete) {
    return <FounderOnboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <AdminCommandCenter
      initialLegacyBaseline={legacyBaseline}
      headquartersSync={syncResult}
    />
  );
}
