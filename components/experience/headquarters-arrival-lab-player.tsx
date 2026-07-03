"use client";

import { useCallback, useState } from "react";
import { HeadquartersArrivalSequence } from "./headquarters-arrival-sequence";
import { ExperienceLabShell } from "./experience-lab-shell";
import { LabControls } from "./lab-controls";

export function HeadquartersArrivalLabPlayer() {
  const [playing, setPlaying] = useState(false);
  const [playKey, setPlayKey] = useState(0);
  const [lastComplete, setLastComplete] = useState(false);

  const start = useCallback(() => {
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
        title="Headquarters Arrival"
        description="The morning sequence when Noah opens Headquarters — quiet confidence, not software login."
      >
        <article className="rounded-[1.5rem] border border-border/70 bg-surface/40 p-5 sm:p-6">
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted">
            Copy preview
          </p>
          <p className="mt-2 font-serif text-lg font-light text-foreground">
            Welcome back, Noah &amp; Dasan.
          </p>
          <p className="mt-2 text-sm text-muted">
            Your company is alive. Let&apos;s continue building it today.
          </p>
        </article>

        <div className="mt-8">
          <LabControls
            playing={playing}
            onPlay={start}
            onReplay={lastComplete ? start : undefined}
            onSkip={playing ? handleSkip : undefined}
            playLabel="Play arrival"
          />
        </div>

        {lastComplete && !playing && (
          <p className="mt-6 text-sm text-muted">
            Arrival complete. Replay to watch again.
          </p>
        )}
      </ExperienceLabShell>

      {playing && (
        <HeadquartersArrivalSequence
          key={playKey}
          previewMode
          onComplete={handleComplete}
        />
      )}
    </>
  );
}
