"use client";

import { useCallback, useEffect, useState } from "react";
import { TechnicianLiveDispatchPanel } from "@/components/admin/technician-live-dispatch-panel";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { useAdminUnlockedState } from "@/lib/admin/use-admin-unlocked-state";
import type { TechnicianOperationalProfile } from "@/lib/field-operations/technician-profile";

export function TechnicianLiveDispatchOverlay({ technicianId }: { technicianId: string }) {
  const [unlocked] = useAdminUnlockedState();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<TechnicianOperationalProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!unlocked) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/technicians/${encodeURIComponent(technicianId)}/profile`,
        { headers: getAdminRequestHeaders(), cache: "no-store" },
      );
      const body = (await response.json().catch(() => null)) as
        | { profile?: TechnicianOperationalProfile; error?: string }
        | null;
      if (!response.ok || !body?.profile) {
        throw new Error(body?.error ?? "Could not load live field truth.");
      }
      setProfile(body.profile);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load live field truth.");
    } finally {
      setLoading(false);
    }
  }, [technicianId, unlocked]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [load, open]);

  if (!unlocked) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[max(1rem,var(--safe-area-bottom))] left-4 z-[72] inline-flex min-h-12 items-center rounded-full border border-accent/30 bg-accent px-5 text-xs font-semibold text-background shadow-[0_18px_60px_rgba(0,0,0,.45)] active:scale-[0.98] sm:left-6"
      >
        Live dispatch
        {profile?.activity.pendingSyncJobs ? (
          <span className="ml-2 rounded-full bg-background/20 px-2 py-0.5 text-[10px]">
            {profile.activity.pendingSyncJobs}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] flex items-end bg-black/65 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6">
          <button
            type="button"
            aria-label="Close live dispatch"
            className="absolute inset-0"
            onClick={() => setOpen(false)}
          />
          <div className="relative max-h-[92svh] w-full overflow-y-auto rounded-t-[2rem] border border-foreground/10 bg-background p-4 pb-[max(1.25rem,var(--safe-area-bottom))] shadow-2xl sm:max-w-5xl sm:rounded-[2rem] sm:p-6">
            <div className="sticky top-0 z-10 mb-2 flex justify-end bg-background/90 py-1 backdrop-blur-xl">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-11 rounded-full border border-foreground/10 px-4 text-xs text-muted"
              >
                Done
              </button>
            </div>
            {loading && !profile ? (
              <div className="p-12 text-center text-sm text-muted">Loading live field truth…</div>
            ) : null}
            {error ? (
              <p role="alert" className="rounded-xl border border-danger/25 bg-danger/[0.07] p-4 text-sm text-danger">
                {error}
              </p>
            ) : null}
            {profile ? (
              <TechnicianLiveDispatchPanel
                technicianId={technicianId}
                profile={profile}
                onSaved={() => void load()}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
