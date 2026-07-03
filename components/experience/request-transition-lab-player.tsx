"use client";

import { useCallback, useRef, useState } from "react";
import { RequestPlanTransition } from "@/components/experience/request-plan-transition";
import { ExperienceLabShell } from "./experience-lab-shell";
import { LabControls } from "./lab-controls";

export function RequestTransitionLabPlayer() {
  const [active, setActive] = useState(false);
  const [playKey, setPlayKey] = useState(0);
  const [lastComplete, setLastComplete] = useState(false);
  const skipRef = useRef(false);

  const start = useCallback(() => {
    skipRef.current = false;
    setPlayKey((k) => k + 1);
    setLastComplete(false);
    setActive(true);
  }, []);

  const handleComplete = useCallback(() => {
    setActive(false);
    setLastComplete(true);
  }, []);

  const handleSkip = useCallback(() => {
    skipRef.current = true;
    setActive(false);
    setLastComplete(true);
  }, []);

  return (
    <>
      <ExperienceLabShell
        title="Request Plan Transition"
        description="The squeegee wipe and rotating status messages — same component used after the request form submits."
      >
        <article className="rounded-[1.5rem] border border-border/70 bg-surface/40 p-5 sm:p-6">
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted">
            Trigger
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Simulates successful Home Care Plan request submission. No form data
            is sent.
          </p>
        </article>

        <div className="mt-8">
          <LabControls
            playing={active}
            onPlay={start}
            onReplay={lastComplete ? start : undefined}
            onSkip={active ? handleSkip : undefined}
            playLabel="Play transition"
          />
        </div>

        {lastComplete && !active && (
          <p className="mt-6 text-sm text-muted">
            {skipRef.current ? "Skipped." : "Transition complete."} Replay to
            watch again.
          </p>
        )}
      </ExperienceLabShell>

      <RequestPlanTransition
        key={playKey}
        active={active}
        onComplete={handleComplete}
      />
    </>
  );
}
