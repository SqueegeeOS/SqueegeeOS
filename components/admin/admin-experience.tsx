"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminCommandCenter } from "@/components/admin/admin-command-center";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { FounderOnboarding } from "@/components/admin/founder-onboarding";
import { HeadquartersImportDraftBanner } from "@/components/admin/headquarters-import-draft-banner";
import { HeadquartersSchemaSetup } from "@/components/admin/headquarters-schema-setup";
import { HeadquartersArrivalSequence } from "@/components/experience/headquarters-arrival-sequence";
import { ShimmerBlock } from "@/components/motion/shimmer-block";
import {
  importLocalHeadquartersDraft,
  syncHeadquartersProfile,
  type HeadquartersSyncResult,
} from "@/lib/admin/headquarters-profile-client";
import {
  isHeadquartersInitialized,
  type LegacyBaseline,
} from "@/lib/admin/legacy-baseline";
import { isAdminUnlocked } from "@/lib/admin/pin";
import type { MotionProfile } from "@/lib/motion/boot-sequence";
import {
  markHeadquartersBootComplete,
  shouldRunHeadquartersBoot,
} from "@/lib/motion/boot-sequence";

export function AdminExperience() {
  const [unlocked, setUnlocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [legacyBaseline, setLegacyBaseline] =
    useState<LegacyBaseline | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [syncResult, setSyncResult] = useState<HeadquartersSyncResult | null>(
    null,
  );
  const [importingDraft, setImportingDraft] = useState(false);
  const [showArrival, setShowArrival] = useState(false);
  const [hqMotionProfile, setHqMotionProfile] = useState<MotionProfile>("none");
  const [hqVisible, setHqVisible] = useState(false);

  const applySyncResult = useCallback((result: HeadquartersSyncResult) => {
    setLegacyBaseline(result.baseline);
    setOnboardingComplete(isHeadquartersInitialized(result.baseline));
    setSyncResult(result);
  }, []);

  const runCloudSync = useCallback(async () => {
    const result = await syncHeadquartersProfile();
    applySyncResult(result);
    return result;
  }, [applySyncResult]);

  useEffect(() => {
    setUnlocked(isAdminUnlocked());
  }, []);

  const handleUnlock = useCallback(() => {
    setUnlocked(true);
    setReady(false);
    void runCloudSync().finally(() => setReady(true));
  }, [runCloudSync]);

  useEffect(() => {
    if (!unlocked) {
      setReady(true);
      return;
    }

    setReady(false);
    void runCloudSync().finally(() => setReady(true));
  }, [runCloudSync, unlocked]);

  useEffect(() => {
    if (!ready || !onboardingComplete) return;
    const runArrival = shouldRunHeadquartersBoot();
    setShowArrival(runArrival);
    if (runArrival) {
      setHqVisible(false);
      setHqMotionProfile("settle");
    } else {
      setHqVisible(true);
      setHqMotionProfile("none");
    }
  }, [onboardingComplete, ready]);

  const handleOnboardingComplete = useCallback(
    (baseline: LegacyBaseline, sync?: HeadquartersSyncResult) => {
      setLegacyBaseline(baseline);
      setOnboardingComplete(isHeadquartersInitialized(baseline));
      if (sync) {
        setSyncResult(sync);
      }
    },
    [],
  );

  const handleImportDraft = useCallback(async () => {
    setImportingDraft(true);
    try {
      const result = await importLocalHeadquartersDraft();
      applySyncResult(result);
      if (isHeadquartersInitialized(result.baseline)) {
        setOnboardingComplete(true);
      }
    } finally {
      setImportingDraft(false);
    }
  }, [applySyncResult]);

  const handleArrivalComplete = useCallback(() => {
    markHeadquartersBootComplete();
    setShowArrival(false);
    setHqVisible(true);
    setHqMotionProfile("settle");
  }, []);

  if (!ready) {
    return (
      <div className="relative min-h-[100svh] bg-background">
        <div className="motion-grain pointer-events-none absolute inset-0 opacity-[0.035]" />
        <div className="relative mx-auto flex min-h-[100svh] max-w-md flex-col items-center justify-center px-6">
          <ShimmerBlock className="h-3 w-32 rounded-full" />
          <ShimmerBlock className="mt-6 h-10 w-full rounded-2xl" />
          <ShimmerBlock className="mt-3 h-10 w-4/5 rounded-2xl" />
          <p className="sr-only">Loading Cloud Headquarters…</p>
        </div>
      </div>
    );
  }

  if (!unlocked) {
    return <AdminPinGate onUnlock={handleUnlock} />;
  }

  if (syncResult?.needsSchemaSetup) {
    return (
      <HeadquartersSchemaSetup
        warning={syncResult.warning}
        onReady={() => {
          setReady(false);
          void runCloudSync().finally(() => setReady(true));
        }}
      />
    );
  }

  if (!onboardingComplete) {
    if (syncResult?.pendingLocalImport && syncResult.localDraft) {
      return (
        <div className="flex min-h-[100svh] items-center justify-center bg-background px-5 py-16">
          <div className="max-w-xl space-y-6 rounded-[1.75rem] border border-border/80 bg-surface/45 p-8 text-center">
            <p className="text-[10px] uppercase tracking-[0.28em] text-accent">
              Cloud Headquarters
            </p>
            <h1 className="font-serif text-3xl font-light text-foreground">
              Import your local founder archive
            </h1>
            <p className="text-sm leading-relaxed text-muted">
              This device has a founder archive that has not been saved to
              Supabase yet. Import it once so Noah and Dasan share the same
              Headquarters.
            </p>
            {syncResult.warning && (
              <p className="text-sm text-amber-700">{syncResult.warning}</p>
            )}
            <button
              type="button"
              onClick={() => void handleImportDraft()}
              disabled={importingDraft}
              className="rounded-full border border-accent/30 bg-accent/[0.12] px-8 py-4 text-[10px] uppercase tracking-[0.22em] text-accent disabled:opacity-50"
            >
              {importingDraft ? "Importing…" : "Import local draft to cloud"}
            </button>
          </div>
        </div>
      );
    }

    return <FounderOnboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <>
      {showArrival && (
        <HeadquartersArrivalSequence onComplete={handleArrivalComplete} />
      )}
      {syncResult?.pendingLocalImport && syncResult.localDraft && (
        <HeadquartersImportDraftBanner
          cloudBaseline={syncResult.baseline}
          localDraft={syncResult.localDraft}
          importing={importingDraft}
          onImport={() => void handleImportDraft()}
        />
      )}
      {hqVisible && (
        <AdminCommandCenter
          initialLegacyBaseline={legacyBaseline}
          headquartersSync={syncResult}
          motionProfile={hqMotionProfile}
        />
      )}
    </>
  );
}
