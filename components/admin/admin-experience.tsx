"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminCommandCenter } from "@/components/admin/admin-command-center";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { FounderOnboarding } from "@/components/admin/founder-onboarding";
import { HeadquartersImportDraftBanner } from "@/components/admin/headquarters-import-draft-banner";
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
    } finally {
      setImportingDraft(false);
    }
  }, [applySyncResult]);

  if (!ready) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-background text-muted">
        Loading Cloud Headquarters…
      </div>
    );
  }

  if (!unlocked) {
    return <AdminPinGate onUnlock={handleUnlock} />;
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
      {syncResult?.pendingLocalImport && syncResult.localDraft && (
        <HeadquartersImportDraftBanner
          cloudBaseline={syncResult.baseline}
          localDraft={syncResult.localDraft}
          importing={importingDraft}
          onImport={() => void handleImportDraft()}
        />
      )}
      <AdminCommandCenter
        initialLegacyBaseline={legacyBaseline}
        headquartersSync={syncResult}
      />
    </>
  );
}
