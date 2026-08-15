"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HqFounderNav } from "@/components/admin/hq-founder-nav";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { GlassCard } from "@/components/craft/glass-card";
import { MotionReveal } from "@/components/craft/motion-reveal";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import {
  customerAftercareTaskAnchorId,
  type CustomerAftercareOutcome,
  type CustomerAftercareSnapshot,
  type CustomerAftercareTask,
} from "@/lib/aftercare/customer-aftercare";
import {
  craftEyebrow,
  craftHeading,
  craftPrimaryButton,
  craftSecondaryButton,
} from "@/lib/craft/tokens";
import { ROUTES } from "@/lib/navigation/config";
import {
  CUSTOMER_SERVICE_CASE_CATEGORY_LABELS,
  CUSTOMER_SERVICE_CASE_STATUS_LABELS,
  customerServiceCaseAnchorId,
  type CustomerServiceCaseAction,
  type CustomerServiceCaseAdminView,
} from "@/lib/service-cases/customer-service-case";

const OUTCOME_LABELS: Record<CustomerAftercareOutcome, string> = {
  review_requested: "Review requested",
  already_reviewed: "Already reviewed",
  not_appropriate: "Not appropriate",
  checkin_completed: "Check-in complete",
  not_needed: "Not needed",
};

function taskOutcomes(task: CustomerAftercareTask): CustomerAftercareOutcome[] {
  return task.type === "review_opportunity"
    ? ["review_requested", "already_reviewed", "not_appropriate"]
    : ["checkin_completed", "not_needed"];
}

function formatMoment(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  }).format(new Date(value));
}

function taskTitle(task: CustomerAftercareTask): string {
  return task.type === "review_opportunity"
    ? `${task.homeownerName} has a review-ready visit`
    : `${task.homeownerName} is reaching year ${task.anniversaryNumber}`;
}

function taskDetail(task: CustomerAftercareTask): string {
  return task.type === "review_opportunity"
    ? `${task.serviceLabel} was completed ${formatMoment(task.completedAt)} with customer-visible proof and no open service follow-up.`
    : `Their HomeAtlas care relationship began ${formatMoment(task.membershipStartedAt)}. Use this as a real customer check-in, not an automatic renewal claim.`;
}

function CustomerAftercareCard({
  task,
  note,
  busyOutcome,
  onNoteChange,
  onResolve,
}: {
  task: CustomerAftercareTask;
  note: string;
  busyOutcome: CustomerAftercareOutcome | null;
  onNoteChange: (value: string) => void;
  onResolve: (outcome: CustomerAftercareOutcome) => void;
}) {
  return (
    <div
      id={customerAftercareTaskAnchorId(task.taskKey)}
      className="scroll-mt-24 rounded-[var(--radius-card)] target:ring-2 target:ring-accent/60"
    >
      <GlassCard tone="subtle" motion="rise" className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-accent/20 bg-accent/[0.07] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.17em] text-accent">
                {task.type === "review_opportunity" ? "Review opportunity" : "Annual care"}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
                Due {formatMoment(task.dueAt)}
              </span>
            </div>
            <h2 className="mt-4 font-serif text-2xl font-light text-foreground">
              {taskTitle(task)}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">{taskDetail(task)}</p>
            <p className="mt-3 text-xs leading-5 text-foreground/55">
              {task.propertyLabel}
            </p>
            {task.type === "review_opportunity" ? (
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-foreground/65">
                {task.customerSummaryVisible ? (
                  <span className="rounded-full border border-white/10 px-2.5 py-1">
                    Customer update saved
                  </span>
                ) : null}
                {task.customerPhotoVisible ? (
                  <span className="rounded-full border border-white/10 px-2.5 py-1">
                    Portal photo saved
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <Link
            href={ROUTES.hqCustomerWorkspace("membership", task.membershipId)}
            className={craftSecondaryButton}
          >
            Open member
          </Link>
        </div>

        <div className="mt-5 border-t border-border/45 pt-5">
          <label className="block text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            Private outcome note (optional)
            <textarea
              value={note}
              onChange={(event) => onNoteChange(event.target.value.slice(0, 1000))}
              rows={2}
              maxLength={1000}
              placeholder="What happened, or why this was not the right moment…"
              className="mt-2 w-full resize-y rounded-xl border border-border/70 bg-background/45 px-3.5 py-3 text-sm font-normal normal-case tracking-normal text-foreground outline-none transition-colors placeholder:text-muted/45 focus:border-accent/45"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            {taskOutcomes(task).map((outcome, index) => (
              <button
                key={outcome}
                type="button"
                disabled={busyOutcome !== null}
                onClick={() => onResolve(outcome)}
                className={`${index === 0 ? craftPrimaryButton : craftSecondaryButton} disabled:cursor-wait disabled:opacity-50`}
              >
                {busyOutcome === outcome ? "Saving…" : OUTCOME_LABELS[outcome]}
              </button>
            ))}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

const CASE_ACTION_LABELS: Record<CustomerServiceCaseAction, string> = {
  acknowledge: "Acknowledge",
  resolve: "Mark resolved",
  dismiss: "Close without action",
};

function CustomerServiceCaseCard({
  serviceCase,
  note,
  busyAction,
  onNoteChange,
  onAction,
}: {
  serviceCase: CustomerServiceCaseAdminView;
  note: string;
  busyAction: CustomerServiceCaseAction | null;
  onNoteChange: (value: string) => void;
  onAction: (action: CustomerServiceCaseAction) => void;
}) {
  const actions: CustomerServiceCaseAction[] =
    serviceCase.status === "open"
      ? ["acknowledge", "resolve", "dismiss"]
      : ["resolve", "dismiss"];
  return (
    <div
      id={customerServiceCaseAnchorId(serviceCase.id)}
      className="scroll-mt-24 rounded-[var(--radius-card)] target:ring-2 target:ring-amber-300/60"
    >
      <GlassCard
        tone="subtle"
        motion="rise"
        className="border-amber-300/20 p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-amber-300/25 bg-amber-300/[0.07] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.17em] text-amber-100">
                Customer reported
              </span>
              <span className="rounded-full border border-white/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
                {CUSTOMER_SERVICE_CASE_STATUS_LABELS[serviceCase.status]}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
                {formatMoment(serviceCase.createdAt)}
              </span>
            </div>
            <h2 className="mt-4 font-serif text-2xl font-light text-foreground">
              {serviceCase.homeownerName} · {CUSTOMER_SERVICE_CASE_CATEGORY_LABELS[serviceCase.category]}
            </h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground/75">
              {serviceCase.details}
            </p>
            <p className="mt-3 text-xs leading-5 text-foreground/55">
              {serviceCase.propertyLabel}
            </p>
            {serviceCase.appointmentId ? (
              <p className="mt-2 text-[11px] text-muted">
                Linked to a visit in this member&apos;s care record.
              </p>
            ) : null}
          </div>
          <Link
            href={ROUTES.hqCustomerWorkspace(
              "membership",
              serviceCase.membershipId,
            )}
            className={craftSecondaryButton}
          >
            Open member
          </Link>
        </div>

        <div className="mt-5 border-t border-border/45 pt-5">
          <label className="block text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            Private handling note
            <textarea
              value={note}
              onChange={(event) => onNoteChange(event.target.value.slice(0, 1000))}
              rows={2}
              maxLength={1000}
              placeholder="What did we do, or what needs to happen next?"
              className="mt-2 w-full resize-y rounded-xl border border-border/70 bg-background/45 px-3.5 py-3 text-sm font-normal normal-case tracking-normal text-foreground outline-none transition-colors placeholder:text-muted/45 focus:border-accent/45"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            {actions.map((action, index) => (
              <button
                key={action}
                type="button"
                disabled={
                  busyAction !== null ||
                  (action === "dismiss" && note.trim().length === 0)
                }
                onClick={() => onAction(action)}
                className={`${index === 0 ? craftPrimaryButton : craftSecondaryButton} disabled:cursor-wait disabled:opacity-50`}
              >
                {busyAction === action ? "Saving…" : CASE_ACTION_LABELS[action]}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-muted">
            These actions update HomeAtlas only. Contact the customer separately;
            no text or email is sent here.
          </p>
        </div>
      </GlassCard>
    </div>
  );
}

export function CustomerAftercarePage() {
  const [snapshot, setSnapshot] = useState<CustomerAftercareSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, CustomerAftercareOutcome | null>>({});
  const [caseNotes, setCaseNotes] = useState<Record<string, string>>({});
  const [caseBusy, setCaseBusy] = useState<
    Record<string, CustomerServiceCaseAction | null>
  >({});
  const requestRef = useRef<AbortController | null>(null);

  const load = useCallback(async (showLoading = false) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    if (showLoading) setLoading(true);
    try {
      const response = await fetch("/api/admin/aftercare", {
        headers: getAdminRequestHeaders(),
        cache: "no-store",
        signal: controller.signal,
      });
      const data = (await response.json()) as CustomerAftercareSnapshot & {
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Aftercare could not load.");
      setSnapshot(data);
      setError(null);
    } catch (loadError) {
      if (controller.signal.aborted) return;
      setError(loadError instanceof Error ? loadError.message : "Aftercare could not load.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(false), 0);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(false);
    }, 120_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      requestRef.current?.abort();
    };
  }, [load]);

  const counts = useMemo(() => {
    const tasks = snapshot?.tasks ?? [];
    return {
      serviceCases: snapshot?.serviceCases.length ?? 0,
      reviews: tasks.filter((task) => task.type === "review_opportunity").length,
      checkins: tasks.filter((task) => task.type === "annual_care_checkin").length,
    };
  }, [snapshot]);

  const resolve = useCallback(
    async (task: CustomerAftercareTask, outcome: CustomerAftercareOutcome) => {
      setBusy((current) => ({ ...current, [task.taskKey]: outcome }));
      setFeedback(null);
      try {
        const response = await fetch("/api/admin/aftercare", {
          method: "POST",
          headers: {
            ...getAdminRequestHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            taskKey: task.taskKey,
            outcome,
            note: notes[task.taskKey] ?? "",
          }),
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(data.error ?? "Aftercare could not be saved.");
        setSnapshot((current) =>
          current
            ? {
                ...current,
                tasks: current.tasks.filter((candidate) => candidate.taskKey !== task.taskKey),
              }
            : current,
        );
        setFeedback(`${OUTCOME_LABELS[outcome]} for ${task.homeownerName}. No message was sent.`);
      } catch (saveError) {
        setFeedback(saveError instanceof Error ? saveError.message : "Aftercare could not be saved.");
      } finally {
        setBusy((current) => ({ ...current, [task.taskKey]: null }));
      }
    },
    [notes],
  );

  const handleServiceCase = useCallback(
    async (
      serviceCase: CustomerServiceCaseAdminView,
      action: CustomerServiceCaseAction,
    ) => {
      setCaseBusy((current) => ({ ...current, [serviceCase.id]: action }));
      setFeedback(null);
      try {
        const response = await fetch("/api/admin/aftercare", {
          method: "POST",
          headers: {
            ...getAdminRequestHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            operation: "service_case",
            caseId: serviceCase.id,
            caseAction: action,
            note: caseNotes[serviceCase.id] ?? "",
          }),
        });
        const result = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(result.error ?? "The service case could not be saved.");
        }
        if (action === "acknowledge") {
          setSnapshot((current) =>
            current
              ? {
                  ...current,
                  serviceCases: current.serviceCases.map((candidate) =>
                    candidate.id === serviceCase.id
                      ? {
                          ...candidate,
                          status: "acknowledged",
                          acknowledgedAt: new Date().toISOString(),
                        }
                      : candidate,
                  ),
                }
              : current,
          );
        } else {
          setSnapshot((current) =>
            current
              ? {
                  ...current,
                  serviceCases: current.serviceCases.filter(
                    (candidate) => candidate.id !== serviceCase.id,
                  ),
                }
              : current,
          );
        }
        setFeedback(
          `${CASE_ACTION_LABELS[action]} for ${serviceCase.homeownerName}. No message was sent.`,
        );
      } catch (saveError) {
        setFeedback(
          saveError instanceof Error
            ? saveError.message
            : "The service case could not be saved.",
        );
      } finally {
        setCaseBusy((current) => ({ ...current, [serviceCase.id]: null }));
      }
    },
    [caseNotes],
  );

  return (
    <AmbientStage className="px-4 py-10 text-foreground sm:px-6 sm:py-12">
      <div className="relative mx-auto max-w-6xl">
        <HqFounderNav />
        <MotionReveal className="mb-8 mt-10">
          <p className={craftEyebrow}>Care after the visit</p>
          <h1 className={`${craftHeading} mt-3 text-3xl sm:text-4xl`}>Customer aftercare</h1>
          <p className="mt-4 max-w-3xl text-sm leading-[1.7] text-muted">
            Customer-reported concerns come first. HomeAtlas also finds the quiet
            moments that deserve a human touch: a documented visit that may earn a
            review, or an annual member check-in. Recording an outcome never sends a
            text or email.
          </p>
        </MotionReveal>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <GlassCard tone="subtle" className="border-amber-300/15 px-5 py-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Customer cases</p>
            <p className="mt-2 font-serif text-3xl font-light">{snapshot ? counts.serviceCases : "—"}</p>
          </GlassCard>
          <GlassCard tone="subtle" className="px-5 py-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Open care moments</p>
            <p className="mt-2 font-serif text-3xl font-light">{snapshot?.tasks.length ?? "—"}</p>
          </GlassCard>
          <GlassCard tone="subtle" className="px-5 py-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Review-ready visits</p>
            <p className="mt-2 font-serif text-3xl font-light">{snapshot ? counts.reviews : "—"}</p>
          </GlassCard>
          <GlassCard tone="subtle" className="px-5 py-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Annual check-ins</p>
            <p className="mt-2 font-serif text-3xl font-light">{snapshot ? counts.checkins : "—"}</p>
          </GlassCard>
        </div>

        {feedback ? (
          <div className="mb-5 rounded-xl border border-accent/20 bg-accent/[0.06] px-4 py-3 text-sm text-foreground/80" role="status">
            {feedback}
          </div>
        ) : null}
        {loading ? (
          <p className="py-12 text-sm text-muted">Checking durable customer records…</p>
        ) : error ? (
          <GlassCard tone="subtle" className="border-red-500/25 px-6 py-8">
            <p className="text-sm text-red-300">{error}</p>
            <p className="mt-2 text-xs leading-5 text-muted">
              Migrations 059 and 060 plus readable source records are required.
              HomeAtlas is treating unknown as unavailable, not as healthy.
            </p>
          </GlassCard>
        ) : snapshot && (snapshot.serviceCases.length > 0 || snapshot.tasks.length > 0) ? (
          <div className="space-y-5">
            {snapshot.truncated ? (
              <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-100/80">
                This is a bounded view. Work the visible tasks, then refresh for the next set.
              </div>
            ) : null}
            {snapshot.serviceCases.map((serviceCase) => (
              <CustomerServiceCaseCard
                key={serviceCase.id}
                serviceCase={serviceCase}
                note={caseNotes[serviceCase.id] ?? serviceCase.ownerNote ?? ""}
                busyAction={caseBusy[serviceCase.id] ?? null}
                onNoteChange={(value) =>
                  setCaseNotes((current) => ({
                    ...current,
                    [serviceCase.id]: value,
                  }))
                }
                onAction={(action) =>
                  void handleServiceCase(serviceCase, action)
                }
              />
            ))}
            {snapshot.tasks.map((task) => (
              <CustomerAftercareCard
                key={task.taskKey}
                task={task}
                note={notes[task.taskKey] ?? ""}
                busyOutcome={busy[task.taskKey] ?? null}
                onNoteChange={(value) =>
                  setNotes((current) => ({ ...current, [task.taskKey]: value }))
                }
                onResolve={(outcome) => void resolve(task, outcome)}
              />
            ))}
          </div>
        ) : (
          <GlassCard tone="subtle" className="px-6 py-14 text-center">
            <p className="font-serif text-2xl font-light">Aftercare is clear.</p>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
              There are no customer-reported service cases, verified review
              opportunities, or annual member check-ins inside their action windows
              right now.
            </p>
          </GlassCard>
        )}
      </div>
    </AmbientStage>
  );
}
