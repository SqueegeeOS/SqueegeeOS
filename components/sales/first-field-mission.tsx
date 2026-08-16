"use client";

import type { SalesRepLaunchReadiness } from "@/lib/sales/rep-launch-readiness";

function missionAction(input: {
  readiness: SalesRepLaunchReadiness;
  onAddHomeowner: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const buttonClass =
    "inline-flex min-h-11 items-center justify-center rounded-full border border-emerald-200/35 bg-emerald-200 px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#07110c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-100";

  switch (input.readiness.stage) {
    case "first_door_needed":
      return <a href="#pulse" className={buttonClass}>Start at the next door</a>;
    case "first_homeowner_needed":
      return (
        <button type="button" onClick={input.onAddHomeowner} className={buttonClass}>
          Capture first homeowner
        </button>
      );
    case "first_plan_needed":
      return <a href="#follow-ups" className={buttonClass}>Open homeowner queue</a>;
    case "first_close_needed":
      return <a href="#follow-ups" className={buttonClass}>Resume the live plan</a>;
    case "proven":
      return <a href="#verified-closes" className={buttonClass}>See verified close</a>;
    case "evidence_unavailable":
      return (
        <button
          type="button"
          onClick={input.onRefresh}
          disabled={input.refreshing}
          className={buttonClass}
        >
          {input.refreshing ? "Checking…" : "Refresh mission"}
        </button>
      );
    default:
      return null;
  }
}

export function FirstFieldMission({
  displayName,
  readiness,
  onAddHomeowner,
  onRefresh,
  refreshing,
}: {
  displayName: string;
  readiness: SalesRepLaunchReadiness;
  onAddHomeowner: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const progress = (readiness.completedCount / readiness.totalCount) * 100;

  return (
    <section
      id="first-field-mission"
      className="mb-5 overflow-hidden rounded-[1.5rem] border border-emerald-300/25 bg-[radial-gradient(circle_at_88%_0%,rgba(110,231,183,0.13),transparent_38%),rgba(7,22,16,0.82)] p-4 shadow-[0_16px_48px_rgba(0,0,0,0.24)] sm:p-5"
      aria-labelledby="first-field-mission-title"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-200/75">
            First field mission · live proof
          </p>
          <h2 id="first-field-mission-title" className="mt-2 font-serif text-2xl text-white sm:text-3xl">
            One real homeowner, all the way through.
          </h2>
          <p className="mt-2 text-xs leading-5 text-white/52">
            {readiness.nextAction} HomeAtlas advances this only from saved field
            evidence—never from a practice tap.
          </p>
        </div>
        <div className="flex shrink-0 items-baseline gap-1 text-emerald-100">
          <span className="font-serif text-4xl tabular-nums">{readiness.completedCount}</span>
          <span className="text-sm text-emerald-100/45">/ {readiness.totalCount}</span>
        </div>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-black/30" aria-hidden="true">
        <div
          className="h-full rounded-full bg-emerald-200 transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-5 gap-1.5" aria-label={`${displayName}'s first field mission progress`}>
        {readiness.steps.map((step) => (
          <div
            key={step.id}
            className={`min-w-0 rounded-xl border px-1.5 py-2 text-center ${
              step.state === "complete"
                ? "border-emerald-200/25 bg-emerald-200/[0.09]"
                : step.state === "unknown"
                  ? "border-amber-200/20 bg-amber-200/[0.06]"
                  : "border-white/[0.07] bg-black/15"
            }`}
            title={step.detail}
          >
            <p
              className={`truncate text-[8px] font-bold uppercase tracking-[0.06em] ${
                step.state === "complete"
                  ? "text-emerald-100"
                  : step.state === "unknown"
                    ? "text-amber-100/75"
                    : "text-white/40"
              }`}
            >
              {step.state === "complete" ? "✓" : step.state === "unknown" ? "?" : "○"} {step.label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[10px] leading-4 text-white/38">
          No message or payment happens from this checklist.
        </p>
        {missionAction({ readiness, onAddHomeowner, onRefresh, refreshing })}
      </div>
    </section>
  );
}
