"use client";

import { useCallback, useEffect, useState } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import type {
  TechnicianCapacitySnapshot,
  TechnicianCapacityWeekForecast,
} from "@/lib/field-operations/technician-capacity";

function hours(minutes: number | null): string {
  if (minutes === null) return "Unknown";
  return `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)}h`;
}

function money(cents: number | null): string {
  if (cents === null) return "Not set";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function weekLabel(weekStart: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${weekStart}T12:00:00`));
}

function stateCopy(week: TechnicianCapacityWeekForecast): {
  label: string;
  className: string;
} {
  if (week.state === "source_unavailable") {
    return {
      label: "Source unavailable",
      className: "border-red-300/25 bg-red-300/[0.08] text-red-100",
    };
  }
  if (week.state === "no_plan") {
    return {
      label: "Capacity not declared",
      className: "border-amber-300/25 bg-amber-300/[0.08] text-amber-100",
    };
  }
  if (week.overCapacity) {
    return {
      label: "Over declared capacity",
      className: "border-red-300/25 bg-red-300/[0.08] text-red-100",
    };
  }
  return {
    label: "Inside declared capacity",
    className: "border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-100",
  };
}

export function TechnicianCapacityPanel() {
  const [snapshot, setSnapshot] = useState<TechnicianCapacitySnapshot | null>(
    null,
  );
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("");
  const [effectiveWeekStart, setEffectiveWeekStart] = useState("");
  const [capacityHours, setCapacityHours] = useState("");
  const [planningHourlyCost, setPlanningHourlyCost] = useState("");
  const [notes, setNotes] = useState("");
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    if (!silent) setError(null);
    try {
      const response = await fetch("/api/admin/technicians/capacity", {
        headers: getAdminRequestHeaders(),
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as
        | (TechnicianCapacitySnapshot & { error?: string })
        | null;
      if (!response.ok || !body) {
        throw new Error(body?.error ?? "Could not load field capacity.");
      }
      setSnapshot(body);
      setPendingRequestId(null);
      setSelectedTechnicianId((current) =>
        body.technicians.some(
          (technician) => technician.jobberUserId === current,
        )
          ? current
          : (body.technicians.find(
              (technician) => technician.mirroredRosterActive,
            )?.jobberUserId ?? body.technicians[0]?.jobberUserId ?? ""),
      );
      setEffectiveWeekStart((current) =>
        body.weeks.some((week) => week.weekStart === current)
          ? current
          : (body.weeks[0]?.weekStart ?? ""),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load field capacity.",
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const selected =
    snapshot?.technicians.find(
      (technician) => technician.jobberUserId === selectedTechnicianId,
    ) ?? null;

  async function savePlan() {
    if (!selected || !effectiveWeekStart) return;
    const parsedHours = Number(capacityHours);
    const parsedCost = planningHourlyCost.trim()
      ? Number(planningHourlyCost)
      : null;
    if (!Number.isFinite(parsedHours) || parsedHours < 0 || parsedHours > 80) {
      setError("Enter weekly production capacity between 0 and 80 hours.");
      return;
    }
    if (
      parsedCost !== null &&
      (!Number.isFinite(parsedCost) || parsedCost < 0 || parsedCost > 1_000)
    ) {
      setError("Enter a planning labor cost between $0 and $1,000 per hour.");
      return;
    }
    const clientRequestId = pendingRequestId ?? crypto.randomUUID();
    setPendingRequestId(clientRequestId);
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/technicians/capacity", {
        method: "POST",
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({
          action: "record_capacity_plan",
          clientRequestId,
          jobberUserId: selected.jobberUserId,
          displayName: selected.displayName,
          effectiveWeekStart,
          weeklyCapacityMinutes: Math.round(parsedHours * 60),
          planningHourlyCostCents:
            parsedCost === null ? null : Math.round(parsedCost * 100),
          notes,
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Could not save the capacity plan.");
      }
      setPendingRequestId(null);
      setNotes("");
      setNotice(
        "Capacity plan added to the audit history. The newest effective plan now drives the runway.",
      );
      await load(true);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save the capacity plan.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading && !snapshot) {
    return (
      <section className="mt-8 rounded-[2rem] border border-white/10 bg-black/20 p-8 text-center text-sm text-muted">
        Calculating the four-week field runway…
      </section>
    );
  }

  return (
    <section className="mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-[#0d1211]">
      <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(104,196,255,0.12),transparent_45%)] p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <p className="text-[10px] uppercase tracking-[0.2em] text-sky-200/75">
              Production capacity · Current booked runway
            </p>
            <h2 className="mt-2 font-serif text-3xl font-light tracking-[-0.03em] text-white sm:text-4xl">
              Book the field team—not Noah by default.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">
              Declare the hours a technician can actually produce, then compare
              them with the current four-week Jobber schedule. HomeAtlas surfaces
              overload and unassigned work; it never schedules Noah as the answer.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || saving}
            className="min-h-12 shrink-0 rounded-full border border-white/10 px-5 text-xs text-white/65 disabled:opacity-40"
          >
            {loading ? "Refreshing…" : "Refresh runway"}
          </button>
        </div>
      </div>

      <div className="p-5 sm:p-7">
        {error ? (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-red-300/25 bg-red-300/[0.07] p-4 text-sm text-red-100"
          >
            {error}
          </p>
        ) : null}
        {notice ? (
          <p
            role="status"
            className="mb-4 rounded-xl border border-emerald-300/25 bg-emerald-300/[0.07] p-4 text-sm text-emerald-100"
          >
            {notice}
          </p>
        ) : null}
        {snapshot?.warnings.map((warning) => (
          <p
            key={warning}
            className="mb-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-4 text-xs leading-relaxed text-amber-100/80"
          >
            {warning}
          </p>
        ))}

        {snapshot ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {snapshot.weeks.map((week, index) => {
              const remaining = week.remainingCrewMinutes;
              const overloaded = remaining !== null && remaining < 0;
              return (
                <div
                  key={week.weekStart}
                  className={`rounded-[1.2rem] border p-4 ${
                    overloaded
                      ? "border-red-300/25 bg-red-300/[0.06]"
                      : "border-white/10 bg-white/[0.025]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] uppercase tracking-[0.15em] text-white/35">
                      {index === 0 ? "This week" : `Week ${index + 1}`}
                    </p>
                    <p className="text-xs text-white/55">
                      {weekLabel(week.weekStart)}
                    </p>
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-white">
                    {remaining === null
                      ? "Unknown"
                      : overloaded
                        ? `${hours(Math.abs(remaining))} over`
                        : `${hours(remaining)} open`}
                  </p>
                  <p className="mt-1 text-[11px] text-white/35">
                    {hours(week.scheduledCrewMinutes)} scheduled / {hours(week.declaredCapacityMinutes)} declared
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[9px] uppercase tracking-[0.1em]">
                    <span className="rounded-full border border-white/10 px-2 py-1 text-white/40">
                      {week.scheduledVisits ?? "?"} visits
                    </span>
                    <span
                      className={`rounded-full border px-2 py-1 ${
                        (week.unassignedStops ?? 0) > 0
                          ? "border-amber-300/25 text-amber-100"
                          : "border-white/10 text-white/40"
                      }`}
                    >
                      {week.unassignedStops ?? "?"} unassigned
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {snapshot && snapshot.technicians.length > 0 ? (
          <>
            <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
              {snapshot.technicians.map((technician) => (
                <button
                  key={technician.jobberUserId}
                  type="button"
                  onClick={() => {
                    setSelectedTechnicianId(technician.jobberUserId);
                    setPendingRequestId(null);
                  }}
                  className={`min-h-12 shrink-0 rounded-full border px-5 text-sm transition ${
                    selectedTechnicianId === technician.jobberUserId
                      ? "border-sky-200/45 bg-sky-200 text-[#07110c]"
                      : "border-white/10 bg-white/[0.035] text-white/65"
                  }`}
                >
                  {technician.displayName}
                </button>
              ))}
            </div>

            {selected ? (
              <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.025] p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                        {selected.displayName} · Four-week booked load
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-white">
                        Exact schedule against declared hours
                      </h3>
                    </div>
                    {!selected.mirroredRosterActive ? (
                      <span className="rounded-full border border-amber-300/20 px-3 py-1 text-[10px] text-amber-100">
                        Historical · not current roster
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 space-y-3">
                    {selected.weeks.map((week) => {
                      const status = stateCopy(week);
                      return (
                        <div
                          key={week.weekStart}
                          className="rounded-xl border border-white/10 bg-black/20 p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-sm font-medium text-white">
                                Week of {weekLabel(week.weekStart)}
                              </p>
                              <p className="mt-1 text-[11px] leading-relaxed text-white/38">
                                {week.detail}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] ${status.className}`}
                            >
                              {status.label}
                            </span>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {[
                              [hours(week.scheduledMinutes), "booked"],
                              [hours(week.capacityMinutes), "declared"],
                              [hours(week.remainingMinutes), "remaining"],
                              [money(week.planningLaborCostCents), "planned labor"],
                            ].map(([value, label]) => (
                              <div
                                key={label}
                                className="rounded-lg border border-white/10 bg-white/[0.025] p-3"
                              >
                                <p className="text-sm font-semibold text-white">{value}</p>
                                <p className="mt-1 text-[9px] uppercase tracking-[0.1em] text-white/30">
                                  {label}
                                </p>
                              </div>
                            ))}
                          </div>
                          {week.utilizationPercent !== null ? (
                            <p className="mt-3 text-[10px] text-white/35">
                              {week.utilizationPercent.toFixed(1)}% of owner-declared capacity currently booked · {week.scheduledStops ?? 0} assigned stops
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.025] p-5">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-sky-200/70">
                    Owner planning input
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-white">
                    Declare weekly capacity
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-white/40">
                    Add a new effective plan instead of rewriting history. Set zero
                    when the technician has no production availability that week.
                  </p>

                  <label className="mt-4 block text-xs text-white/55">
                    Effective Monday
                    <select
                      value={effectiveWeekStart}
                      onChange={(event) => {
                        setEffectiveWeekStart(event.target.value);
                        setPendingRequestId(null);
                      }}
                      className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-[#111615] px-3 text-sm text-white outline-none focus:border-sky-200/45"
                    >
                      {snapshot.weeks.map((week) => (
                        <option key={week.weekStart} value={week.weekStart}>
                          Week of {weekLabel(week.weekStart)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="mt-3 block text-xs text-white/55">
                    Available production hours
                    <input
                      type="number"
                      min="0"
                      max="80"
                      step="0.5"
                      inputMode="decimal"
                      value={capacityHours}
                      onChange={(event) => {
                        setCapacityHours(event.target.value);
                        setPendingRequestId(null);
                      }}
                      placeholder="Example: 32"
                      className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-[#111615] px-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-sky-200/45"
                    />
                  </label>
                  <label className="mt-3 block text-xs text-white/55">
                    Planning labor cost / hour (optional)
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      step="0.01"
                      inputMode="decimal"
                      value={planningHourlyCost}
                      onChange={(event) => {
                        setPlanningHourlyCost(event.target.value);
                        setPendingRequestId(null);
                      }}
                      placeholder="Example: 25"
                      className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-[#111615] px-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-sky-200/45"
                    />
                  </label>
                  <label className="mt-3 block text-xs text-white/55">
                    Planning note (optional)
                    <textarea
                      value={notes}
                      onChange={(event) => {
                        setNotes(event.target.value);
                        setPendingRequestId(null);
                      }}
                      rows={3}
                      maxLength={1_000}
                      placeholder="Example: Four eight-hour production days; Friday reserved for training."
                      className="mt-2 w-full rounded-xl border border-white/10 bg-[#111615] p-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-sky-200/45"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void savePlan()}
                    disabled={
                      saving ||
                      !snapshot.schemaAvailable ||
                      !selected.mirroredRosterActive ||
                      capacityHours.trim() === ""
                    }
                    className="mt-4 min-h-12 w-full rounded-xl bg-sky-200 px-5 text-sm font-semibold text-[#07110c] disabled:opacity-35"
                  >
                    {saving ? "Saving plan…" : "Add capacity plan"}
                  </button>

                  <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-[11px] leading-relaxed text-white/38">
                    <p className="font-medium text-white/60">Evidence boundary</p>
                    <p className="mt-1">
                      Hourly cost is a planning assumption—not payroll or loaded
                      labor proof. Booked schedule is not earned revenue. HomeAtlas
                      will not claim gross profit until reliable revenue and cost
                      inputs exist.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-white/40">
            Sync a Jobber route with an assigned technician before declaring capacity.
          </p>
        )}
      </div>
    </section>
  );
}
