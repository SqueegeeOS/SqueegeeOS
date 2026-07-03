"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminCommandCenter } from "@/components/admin/admin-command-center";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { FounderOnboarding } from "@/components/admin/founder-onboarding";
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

  const handleUnlock = useCallback(() => setUnlocked(true), []);

  useEffect(() => {
    setUnlocked(isAdminUnlocked());
    setLegacyBaseline(loadLegacyBaseline());
    setOnboardingComplete(isFounderOnboardingComplete());
    setReady(true);
  }, []);

  const handleOnboardingComplete = useCallback((baseline: LegacyBaseline) => {
    setLegacyBaseline(baseline);
    setOnboardingComplete(true);
  }, []);

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

  return <AdminCommandCenter initialLegacyBaseline={legacyBaseline} />;
}
