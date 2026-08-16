"use client";

import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { HqFounderNav } from "@/components/admin/hq-founder-nav";
import { JobberConnectionPanel } from "@/components/admin/jobber-connection-panel";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { MotionReveal } from "@/components/craft/motion-reveal";
import { useAdminUnlockedState } from "@/lib/admin/use-admin-unlocked-state";
import type { JobberHandoffFocus } from "@/lib/care-operations/jobber-handoff-navigation";
import { craftEyebrow, craftHeading } from "@/lib/craft/tokens";

function JobberHeadquartersContent({
  focus,
}: {
  focus: JobberHandoffFocus | null;
}) {
  return (
    <AmbientStage className="px-4 py-10 text-foreground sm:px-6 sm:py-12">
      <div className="relative mx-auto max-w-5xl">
        <HqFounderNav />
        <MotionReveal className="mb-8 mt-10">
          <p className={craftEyebrow}>Care operations</p>
          <h1 className={`${craftHeading} mt-3 text-3xl sm:text-4xl`}>
            Jobber Workspace
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-[1.65] text-muted">
            One place to synchronize Jobber, search every customer and visit,
            and supervise the links that connect Jobber records to HomeAtlas.
          </p>
        </MotionReveal>
        <JobberConnectionPanel focus={focus} />
      </div>
    </AmbientStage>
  );
}

export function JobberHeadquartersPage({
  focus,
}: {
  focus: JobberHandoffFocus | null;
}) {
  const [unlocked, setUnlocked] = useAdminUnlockedState();
  if (!unlocked) {
    return <AdminPinGate onUnlock={() => setUnlocked(true)} />;
  }
  return <JobberHeadquartersContent focus={focus} />;
}
