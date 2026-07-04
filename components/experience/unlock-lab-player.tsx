"use client";

import { useCallback, useState } from "react";
import { MembershipUnlockSequence } from "@/components/membership/unlock/membership-unlock-sequence";
import {
  EXPERIENCE_UNLOCK_CONTEXT,
} from "@/lib/experience/lab-config";
import type { UnlockTimingProfile } from "@/lib/membership/unlock-sequence";
import { ExperienceLabShell } from "./experience-lab-shell";
import { LabControls } from "./lab-controls";

export function UnlockLabPlayer() {
  const [playing, setPlaying] = useState(false);
  const [profile, setProfile] = useState<UnlockTimingProfile>("full");
  const [playKey, setPlayKey] = useState(0);
  const [lastComplete, setLastComplete] = useState(false);

  const start = useCallback((nextProfile: UnlockTimingProfile) => {
    setProfile(nextProfile);
    setPlayKey((k) => k + 1);
    setLastComplete(false);
    setPlaying(true);
  }, []);

  const handleComplete = useCallback(() => {
    setPlaying(false);
    setLastComplete(true);
  }, []);

  const handleSkip = useCallback(() => {
    setPlaying(false);
    setLastComplete(true);
  }, []);

  return (
    <>
      <ExperienceLabShell
        title="Membership Unlock Ceremony"
        description="Apollo Unlock Ceremony v2 — constellation particles, key forge, bloom, and welcome sequence. Larry Buckley · Canyon Oaks demo context."
      >
        <article className="rounded-[1.5rem] border border-border/70 bg-surface/40 p-5 sm:p-6">
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted">
            Sample member
          </p>
          <p className="mt-2 font-serif text-xl font-light text-foreground">
            {EXPERIENCE_UNLOCK_CONTEXT.homeownerFullName}
          </p>
          <p className="mt-1 text-sm text-muted">
            {EXPERIENCE_UNLOCK_CONTEXT.propertyName} ·{" "}
            {EXPERIENCE_UNLOCK_CONTEXT.planName}
          </p>
        </article>

        <div className="mt-8">
          <LabControls
            playing={playing}
            onPlay={() => start("full")}
            onPlayFast={() => start("fast")}
            onReplay={lastComplete ? () => start(profile) : undefined}
            onSkip={playing ? handleSkip : undefined}
            playLabel="Play full ceremony"
            playFastLabel="Play fast ceremony"
          />
        </div>

        {lastComplete && !playing && (
          <p className="mt-6 text-sm text-muted">
            Ceremony complete. Use Replay to watch again.
          </p>
        )}
      </ExperienceLabShell>

      {playing && (
        <MembershipUnlockSequence
          key={playKey}
          context={EXPERIENCE_UNLOCK_CONTEXT}
          timingProfile={profile}
          previewMode
          onComplete={handleComplete}
        />
      )}
    </>
  );
}
