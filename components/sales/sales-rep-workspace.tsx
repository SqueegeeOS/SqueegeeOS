"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { GlassCard } from "@/components/craft/glass-card";
import { AtlasMark } from "@/components/theme/atlas-mark";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import {
  buildStandardRepProfile,
  DAVID_REP_PROFILE,
  getMilestoneProgress,
  type SalesRepProfile,
} from "@/lib/sales/rep-config";
import type {
  CreateSalesLeadInput,
  SalesActivityReceipt,
  SalesActivityType,
  SalesRepLead,
  SalesWorkspaceMetrics,
  SalesWorkspacePayload,
} from "@/lib/sales/workspace-types";
import {
  craftEyebrow,
  craftHeading,
  craftInput,
  craftLabel,
  craftPrimaryButton,
  craftSecondaryButton,
  craftTextarea,
} from "@/lib/craft/tokens";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface SalesRepWorkspaceProps {
  repSlug: string;
}

interface ActivityMutationResponse {
  activity?: SalesActivityReceipt;
  error?: string;
  message?: string;
}

const EMPTY_METRICS: SalesWorkspaceMetrics = {
  doorsToday: 0,
  conversationsToday: 0,
  presentationsToday: 0,
  leadsToday: 0,
  signedToday: 0,
  openPipelineCount: 0,
  pipelineArrCents: 0,
  qualifiedRetainedMembers: 0,
};

const EMPTY_LEAD_FORM: CreateSalesLeadInput = {
  fullName: "",
  propertyAddress: "",
  phone: "",
  email: "",
  estimatedArrDollars: 1200,
  nextFollowUpAt: "",
  notes: "",
  smsConsentAttested: false,
  emailConsentAttested: false,
};

const QUICK_ACTIONS: Array<{
  type: SalesActivityType;
  label: string;
  detail: string;
  mark: string;
}> = [
  { type: "door_knock", label: "Door", detail: "Knocked", mark: "+1" },
  { type: "conversation", label: "Talk", detail: "Conversation", mark: "+1" },
  {
    type: "presentation_started",
    label: "Pitch",
    detail: "Presentation",
    mark: "+1",
  },
  {
    type: "membership_signed",
    label: "Signed",
    detail: "Member won",
    mark: "+1",
  },
];

function titleCaseSlug(slug: string) {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function fallbackProfile(repSlug: string): SalesRepProfile {
  const slug = repSlug.trim().toLowerCase();
  if (slug === "david") return DAVID_REP_PROFILE;
  return buildStandardRepProfile({
    slug,
    displayName: titleCaseSlug(slug) || "Field Rep",
  });
}

function moneyFromCents(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function followUpLabel(value: string | null) {
  if (!value) return "No follow-up set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Follow-up time unavailable";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function statusLabel(status: SalesRepLead["status"]) {
  return status.replaceAll("_", " ");
}

async function fetchSalesWorkspace(repSlug: string): Promise<SalesWorkspacePayload> {
  const response = await fetch(
    `/api/sales/${encodeURIComponent(repSlug)}/workspace`,
    { cache: "no-store" },
  );
  const body = (await response.json().catch(() => null)) as
    | (SalesWorkspacePayload & { error?: string })
    | null;
  if (!response.ok || !body?.profile) {
    throw new Error(body?.error ?? "Could not load the private field desk.");
  }
  return body;
}

export function SalesRepWorkspace({ repSlug }: SalesRepWorkspaceProps) {
  const [workspace, setWorkspace] = useState<SalesWorkspacePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activityPending, setActivityPending] = useState<SalesActivityType | null>(null);
  const [undoableActivity, setUndoableActivity] = useState<SalesActivityReceipt | null>(null);
  const [undoPending, setUndoPending] = useState(false);
  const [signedConfirmOpen, setSignedConfirmOpen] = useState(false);
  const signedDialogRef = useRef<HTMLDivElement>(null);
  const [leadFormOpen, setLeadFormOpen] = useState(false);
  const [leadForm, setLeadForm] = useState<CreateSalesLeadInput>(EMPTY_LEAD_FORM);
  const [leadSaving, setLeadSaving] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installHelp, setInstallHelp] = useState<string | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  const profile = workspace?.profile ?? fallbackProfile(repSlug);
  const metrics = workspace?.metrics ?? EMPTY_METRICS;
  const milestone = useMemo(
    () => getMilestoneProgress(profile, metrics.qualifiedRetainedMembers),
    [metrics.qualifiedRetainedMembers, profile],
  );

  const loadWorkspace = useCallback(async () => {
    try {
      setWorkspace(await fetchSalesWorkspace(repSlug));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load the private field desk.",
      );
    } finally {
      setLoading(false);
    }
  }, [repSlug]);

  useEffect(() => {
    let cancelled = false;
    fetchSalesWorkspace(repSlug)
      .then((payload) => {
        if (!cancelled) setWorkspace(payload);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load the private field desk.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repSlug]);

  useEffect(() => {
    const nav = navigator as Navigator & { standalone?: boolean };
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const updateStandaloneState = () => {
      setIsStandalone(displayMode.matches || nav.standalone === true);
    };
    updateStandaloneState();
    displayMode.addEventListener("change", updateStandaloneState);

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    return () => {
      displayMode.removeEventListener("change", updateStandaloneState);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
    };
  }, []);

  useEffect(() => {
    if (!signedConfirmOpen) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSignedConfirmOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = signedDialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const focusFrame = window.requestAnimationFrame(() => {
      signedDialogRef.current
        ?.querySelector<HTMLElement>("[data-initial-focus]")
        ?.focus();
    });
    document.addEventListener("keydown", handleDialogKeys);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleDialogKeys);
      previousFocus?.focus();
    };
  }, [signedConfirmOpen]);

  useEffect(() => {
    if (!undoableActivity) return;

    if (!undoableActivity.undoExpiresAt) return;
    const expiresAt = Date.parse(undoableActivity.undoExpiresAt);
    if (!Number.isFinite(expiresAt)) return;
    const remaining = expiresAt - Date.now();
    const timeout = window.setTimeout(
      () => setUndoableActivity(null),
      Math.max(0, remaining),
    );
    return () => window.clearTimeout(timeout);
  }, [undoableActivity]);

  const installWorkspace = async () => {
    setInstallHelp(null);
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setIsStandalone(true);
      setInstallPrompt(null);
      return;
    }

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setInstallHelp(
      isIos
        ? "On iPhone: tap Share, then Add to Home Screen, then Add."
        : "Open your browser menu and choose Install app or Add to Home screen.",
    );
  };

  const recordActivity = async (activityType: SalesActivityType) => {
    setActivityPending(activityType);
    if (!undoableActivity) setNotice(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/sales/${encodeURIComponent(repSlug)}/workspace`,
        {
          method: "POST",
          headers: getAdminRequestHeaders(),
          body: JSON.stringify({
            kind: "activity",
            activity: { activityType, quantity: 1 },
          }),
        },
      );
      const body = (await response.json().catch(() => null)) as ActivityMutationResponse | null;
      if (!response.ok) throw new Error(body?.error ?? "Could not record activity.");
      setUndoableActivity(body?.activity ?? null);
      setNotice(body?.message ?? "Field activity recorded.");
      await loadWorkspace();
    } catch (activityError) {
      setError(
        activityError instanceof Error
          ? activityError.message
          : "Could not record activity.",
      );
    } finally {
      setActivityPending(null);
    }
  };

  const undoLastActivity = async () => {
    if (!undoableActivity) return;

    const activityId = undoableActivity.id;
    setUndoPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/sales/${encodeURIComponent(repSlug)}/workspace`,
        {
          method: "POST",
          headers: getAdminRequestHeaders(),
          body: JSON.stringify({ kind: "undo_activity", activityId }),
        },
      );
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;
      if (!response.ok) throw new Error(body?.error ?? "Could not undo that activity.");
      setUndoableActivity(null);
      setNotice(body?.message ?? "Last activity undone. Today's total is corrected.");
      await loadWorkspace();
    } catch (undoError) {
      setError(
        undoError instanceof Error
          ? undoError.message
          : "Could not undo that activity.",
      );
    } finally {
      setUndoPending(false);
    }
  };

  const handleQuickAction = (activityType: SalesActivityType) => {
    if (activityType === "membership_signed") {
      setSignedConfirmOpen(true);
      return;
    }

    void recordActivity(activityType);
  };

  const saveLead = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLeadSaving(true);
    setUndoableActivity(null);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/sales/${encodeURIComponent(repSlug)}/workspace`,
        {
          method: "POST",
          headers: getAdminRequestHeaders(),
          body: JSON.stringify({ kind: "lead", lead: leadForm }),
        },
      );
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;
      if (!response.ok) throw new Error(body?.error ?? "Could not save homeowner.");
      setLeadForm(EMPTY_LEAD_FORM);
      setLeadFormOpen(false);
      setNotice(body?.message ?? "Homeowner saved.");
      await loadWorkspace();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Could not save homeowner.",
      );
    } finally {
      setLeadSaving(false);
    }
  };

  const dueLeads = useMemo(() => {
    const leads = workspace?.leads ?? [];
    return [...leads]
      .filter((lead) => !["won", "lost"].includes(lead.status))
      .sort((left, right) => {
        if (!left.nextFollowUpAt) return 1;
        if (!right.nextFollowUpAt) return -1;
        return left.nextFollowUpAt.localeCompare(right.nextFollowUpAt);
      })
      .slice(0, 8);
  }, [workspace?.leads]);

  return (
    <AmbientStage founding className="pb-28">
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#090806]/88 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-8">
          <Link href={profile.workspacePath} className="flex min-h-12 items-center gap-3">
            <AtlasMark size={36} />
            <div>
              <p className="font-serif text-base font-light tracking-[0.08em] text-foreground">
                {`${profile.displayName}'s Field Desk`}
              </p>
              <p className="text-[9px] uppercase tracking-[0.24em] text-accent">
                HomeAtlas private
              </p>
            </div>
          </Link>
          {isStandalone ? (
            <span className="rounded-full border border-emerald-300/20 bg-emerald-300/[0.06] px-3 py-2 text-[9px] uppercase tracking-[0.2em] text-emerald-200">
              Installed
            </span>
          ) : (
            <button
              type="button"
              onClick={() => void installWorkspace()}
              className="min-h-11 rounded-full border border-accent/25 bg-accent/[0.07] px-4 text-[10px] uppercase tracking-[0.18em] text-accent"
            >
              Save to phone
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-8 pt-7 sm:px-8 sm:pt-10">
        <section className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          <GlassCard tone="elevated" padding="lg" rim className="relative overflow-hidden">
            <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-accent/[0.07] blur-3xl" aria-hidden />
            <div className="relative">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] uppercase tracking-[0.3em] text-accent">
                  Field command · {profile.displayName}
                </p>
                {profile.isFoundingRep ? (
                  <span className="rounded-full border border-amber-300/25 bg-amber-300/[0.07] px-2.5 py-1 text-[9px] uppercase tracking-[0.18em] text-amber-200">
                    Founding rep
                  </span>
                ) : null}
              </div>
              <h1 className={`mt-5 max-w-3xl text-4xl sm:text-6xl ${craftHeading}`}>
                Turn every good doorstep into a remembered relationship.
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-muted sm:text-base">
                Capture the homeowner, permission, next move, and value while the
                conversation is still fresh. HomeAtlas keeps the handoff visible.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setLeadFormOpen(true)}
                  className={craftPrimaryButton}
                >
                  Add homeowner
                </button>
                <Link
                  href={`/presentations/new?rep=${encodeURIComponent(profile.slug)}`}
                  className={craftSecondaryButton}
                >
                  Start presentation
                </Link>
              </div>
              {installHelp ? (
                <p className="mt-5 rounded-2xl border border-accent/20 bg-accent/[0.05] px-4 py-3 text-xs leading-5 text-foreground/75">
                  {installHelp}
                </p>
              ) : null}
            </div>
          </GlassCard>

          <GlassCard tone="subtle" padding="lg">
            <p className={craftEyebrow}>Today in the field</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {[
                ["Doors", metrics.doorsToday],
                ["Talks", metrics.conversationsToday],
                ["Pitches", metrics.presentationsToday],
                ["Signed", metrics.signedToday],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/[0.06] bg-black/15 p-4">
                  <p className="font-serif text-3xl tabular-nums text-foreground">
                    {loading ? "–" : value}
                  </p>
                  <p className="mt-1 text-[9px] uppercase tracking-[0.2em] text-muted">
                    {label}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-end justify-between border-t border-white/[0.07] pt-4">
              <div>
                <p className="text-[9px] uppercase tracking-[0.2em] text-muted">Open pipeline</p>
                <p className="mt-1 font-serif text-2xl text-foreground">
                  {loading ? "–" : moneyFromCents(metrics.pipelineArrCents)}
                </p>
              </div>
              <p className="text-xs text-muted">{metrics.openPipelineCount} people</p>
            </div>
          </GlassCard>
        </section>

        <section id="pulse" className="mt-7">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className={craftEyebrow}>One-tap field pulse</p>
              <h2 className={`mt-2 text-2xl sm:text-3xl ${craftHeading}`}>Log the work, keep moving.</h2>
            </div>
            <p className="hidden text-xs text-muted sm:block">Pacific-time daily totals</p>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.type}
                type="button"
                disabled={
                  activityPending !== null ||
                  undoPending ||
                  Boolean(error && !workspace)
                }
                onClick={() => handleQuickAction(action.type)}
                aria-haspopup={
                  action.type === "membership_signed" ? "dialog" : undefined
                }
                aria-label={
                  action.type === "membership_signed"
                    ? "Confirm a signed membership"
                    : `Record one ${action.detail.toLowerCase()}`
                }
                className="group min-h-28 rounded-[1.4rem] border border-white/[0.08] bg-white/[0.035] p-4 text-left shadow-[0_14px_40px_rgba(0,0,0,0.16)] transition-[transform,border-color,background-color] hover:border-accent/25 hover:bg-accent/[0.045] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent/80 active:scale-[0.985] disabled:opacity-45"
              >
                <span className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-accent">
                    {action.label}
                  </span>
                  <span className="font-serif text-xl text-foreground/60 transition-colors group-hover:text-accent">
                    {activityPending === action.type ? "…" : action.mark}
                  </span>
                </span>
                <span className="mt-7 block text-sm text-foreground/80">{action.detail}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-5 text-muted/70 sm:text-xs">
            Door, Talk, and Pitch save instantly. Signed asks for confirmation,
            and the latest entry can be undone.
          </p>
        </section>

        <div className="mt-5">
          {notice ? (
            <div
              className="flex flex-col gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] px-4 py-3 text-sm text-emerald-100 sm:flex-row sm:items-center sm:justify-between"
              role="status"
            >
              <p>{notice}</p>
              {undoableActivity ? (
                <button
                  type="button"
                  onClick={() => void undoLastActivity()}
                  disabled={undoPending || activityPending !== null}
                  aria-label="Undo the last field pulse entry"
                  className="min-h-10 shrink-0 rounded-full border border-emerald-200/25 bg-black/15 px-4 text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-50 transition-colors hover:bg-emerald-100/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-100 disabled:opacity-50"
                >
                  {undoPending ? "Undoing…" : "Undo last entry"}
                </button>
              ) : null}
            </div>
          ) : null}
          {error ? (
            <p className="rounded-2xl border border-red-300/20 bg-red-300/[0.06] px-4 py-3 text-sm text-red-200" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <section id="follow-ups" className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <GlassCard as="section" tone="default" padding="lg">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className={craftEyebrow}>Next-action queue</p>
                <h2 className={`mt-2 text-2xl sm:text-3xl ${craftHeading}`}>People worth remembering</h2>
              </div>
              <button
                type="button"
                onClick={() => setLeadFormOpen(true)}
                className="min-h-11 text-xs uppercase tracking-[0.16em] text-accent"
              >
                + New
              </button>
            </div>

            <div className="mt-6 space-y-3">
              {loading ? (
                <p className="py-8 text-center text-sm text-muted">Loading private queue…</p>
              ) : dueLeads.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/[0.1] px-5 py-9 text-center">
                  <p className="font-serif text-xl text-foreground">Your first doorstep starts here.</p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Add a homeowner and set the next check-in before leaving the driveway.
                  </p>
                </div>
              ) : (
                dueLeads.map((lead) => (
                  <article
                    key={lead.id}
                    className="rounded-2xl border border-white/[0.07] bg-black/10 p-4 sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="truncate font-serif text-xl text-foreground">{lead.fullName}</h3>
                        <p className="mt-1 truncate text-xs text-muted">{lead.propertyAddress}</p>
                      </div>
                      <span className="shrink-0 rounded-full border border-white/[0.08] px-2.5 py-1 text-[9px] uppercase tracking-[0.16em] text-muted">
                        {statusLabel(lead.status)}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
                      <p className="text-xs text-foreground/70">{followUpLabel(lead.nextFollowUpAt)}</p>
                      <p className="text-xs tabular-nums text-accent">
                        {moneyFromCents(lead.estimatedArrCents)} est. ARR
                      </p>
                    </div>
                    <div className="mt-3 flex gap-2 text-[9px] uppercase tracking-[0.14em]">
                      <span className={lead.smsConsentStatus === "opted_in" ? "text-emerald-200" : "text-muted/60"}>
                        Text {lead.smsConsentStatus === "opted_in" ? "approved" : "not approved"}
                      </span>
                      <span className="text-muted/30">·</span>
                      <span className={lead.emailConsentStatus === "opted_in" ? "text-emerald-200" : "text-muted/60"}>
                        Email {lead.emailConsentStatus === "opted_in" ? "approved" : "not approved"}
                      </span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </GlassCard>

          <GlassCard as="section" tone="subtle" padding="lg" className={profile.isFoundingRep ? "border-amber-300/15" : ""}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={craftEyebrow}>{profile.planLabel}</p>
                <h2 className={`mt-2 text-2xl ${craftHeading}`}>
                  {profile.isFoundingRep ? "David's career track" : "Commission profile"}
                </h2>
              </div>
              {profile.isFoundingRep ? (
                <span className="font-serif text-3xl text-amber-200">
                  {milestone.modeledEquityPercent}%
                </span>
              ) : null}
            </div>

            {profile.isFoundingRep ? (
              <>
                <p className="mt-4 text-sm leading-6 text-muted">
                  {metrics.qualifiedRetainedMembers} members have completed the 12-month
                  retention qualification. Draft modeling only—no payout or equity is
                  automatically granted here.
                </p>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent/60 to-amber-200 transition-[width] duration-700"
                    style={{ width: `${milestone.progressPercent}%` }}
                  />
                </div>
                <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-muted">
                  {milestone.nextMilestone
                    ? `${milestone.nextMilestone.retainedMembers - metrics.qualifiedRetainedMembers} more retained members to model ${milestone.nextMilestone.modeledEquityPercent}%`
                    : "Top modeled milestone reached"}
                </p>
              </>
            ) : (
              <p className="mt-4 text-sm leading-6 text-muted">
                This workspace includes standard sales tooling. Founder residual and
                equity modeling are not part of this representative&apos;s profile.
              </p>
            )}

            <div className="mt-6 space-y-3 border-t border-white/[0.07] pt-5">
              {profile.benefits.map((benefit) => (
                <div key={benefit.title}>
                  <p className="text-sm text-foreground/85">{benefit.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted">{benefit.detail}</p>
                </div>
              ))}
            </div>

            {profile.milestones.length > 0 ? (
              <div className="mt-6 grid grid-cols-5 gap-1.5" aria-label="David's modeled equity milestones">
                {profile.milestones.map((item) => (
                  <div
                    key={item.retainedMembers}
                    className={`rounded-xl border px-1 py-2 text-center ${
                      metrics.qualifiedRetainedMembers >= item.retainedMembers
                        ? "border-amber-200/30 bg-amber-200/[0.08] text-amber-100"
                        : "border-white/[0.06] text-muted/60"
                    }`}
                  >
                    <p className="font-serif text-base">{item.modeledEquityPercent}%</p>
                    <p className="mt-0.5 text-[8px] uppercase tracking-[0.1em]">{item.retainedMembers}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </GlassCard>
        </section>

        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          <Link href={`/presentations/new?rep=${encodeURIComponent(profile.slug)}`} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 transition-colors hover:border-accent/25">
            <p className="text-[9px] uppercase tracking-[0.2em] text-accent">Sell</p>
            <p className="mt-2 text-sm text-foreground">Open a HomeAtlas presentation →</p>
          </Link>
          <Link href="/hq/communications" className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 transition-colors hover:border-accent/25">
            <p className="text-[9px] uppercase tracking-[0.2em] text-accent">Follow up</p>
            <p className="mt-2 text-sm text-foreground">Open the shared customer inbox →</p>
          </Link>
          <Link href="/hq/memberships" className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 transition-colors hover:border-accent/25">
            <p className="text-[9px] uppercase tracking-[0.2em] text-accent">Handoff</p>
            <p className="mt-2 text-sm text-foreground">See active memberships →</p>
          </Link>
        </section>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.08] bg-[#090806]/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl" aria-label={`${profile.displayName}'s field desk`}>
        <div className="mx-auto grid max-w-lg grid-cols-4 px-2">
          <a href="#pulse" className="flex min-h-16 flex-col items-center justify-center gap-1 text-[9px] uppercase tracking-[0.14em] text-muted hover:text-accent">
            <span className="font-serif text-lg">＋</span> Pulse
          </a>
          <button type="button" onClick={() => setLeadFormOpen(true)} className="flex min-h-16 flex-col items-center justify-center gap-1 text-[9px] uppercase tracking-[0.14em] text-muted hover:text-accent">
            <span className="font-serif text-lg">◎</span> Homeowner
          </button>
          <a href="#follow-ups" className="flex min-h-16 flex-col items-center justify-center gap-1 text-[9px] uppercase tracking-[0.14em] text-muted hover:text-accent">
            <span className="font-serif text-lg">↗</span> Follow-ups
          </a>
          <Link href="/hq" className="flex min-h-16 flex-col items-center justify-center gap-1 text-[9px] uppercase tracking-[0.14em] text-muted hover:text-accent">
            <span className="font-serif text-lg">⌂</span> HQ
          </Link>
        </div>
      </nav>

      {signedConfirmOpen ? (
        <div className="fixed inset-0 z-[80] flex items-end bg-black/75 px-3 py-4 backdrop-blur-md sm:items-center sm:justify-center sm:px-6 sm:py-10">
          <div
            ref={signedDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-signed-title"
            aria-describedby="confirm-signed-description"
            className="w-full max-w-md"
          >
            <GlassCard tone="elevated" padding="lg" className="!bg-[#0d0b08]">
              <p className={craftEyebrow}>Final checkpoint</p>
              <h2 id="confirm-signed-title" className={`mt-3 text-3xl ${craftHeading}`}>
                Did they sign the membership?
              </h2>
              <p
                id="confirm-signed-description"
                className="mt-4 text-sm leading-6 text-muted"
              >
                Confirm only after the customer has completed the agreement. This
                adds one signed member to today&apos;s total.
              </p>
              <div className="mt-5 rounded-2xl border border-amber-200/15 bg-amber-200/[0.05] px-4 py-3 text-xs leading-5 text-amber-100/80">
                You can undo this entry immediately if anything looks wrong.
              </div>
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setSignedConfirmOpen(false)}
                  disabled={activityPending !== null}
                  className={craftSecondaryButton}
                  data-initial-focus
                >
                  Not yet
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSignedConfirmOpen(false);
                    void recordActivity("membership_signed");
                  }}
                  disabled={activityPending !== null}
                  className={craftPrimaryButton}
                >
                  Yes, membership signed
                </button>
              </div>
            </GlassCard>
          </div>
        </div>
      ) : null}

      {leadFormOpen ? (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/70 px-3 py-4 backdrop-blur-md sm:px-6 sm:py-10">
          <div className="mx-auto max-w-2xl">
            <GlassCard tone="elevated" padding="lg" className="!bg-[#0d0b08]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={craftEyebrow}>Doorstep capture</p>
                  <h2 className={`mt-2 text-3xl ${craftHeading}`}>Remember this homeowner.</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setLeadFormOpen(false)}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] text-xl text-muted"
                  aria-label="Close homeowner form"
                >
                  ×
                </button>
              </div>

              <form onSubmit={saveLead} className="mt-7 space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="sales-lead-name" className={craftLabel}>Homeowner name</label>
                    <input
                      id="sales-lead-name"
                      required
                      autoComplete="name"
                      value={leadForm.fullName}
                      onChange={(event) => setLeadForm((current) => ({ ...current, fullName: event.target.value }))}
                      className={craftInput}
                      placeholder="First and last name"
                    />
                  </div>
                  <div>
                    <label htmlFor="sales-lead-address" className={craftLabel}>Property address</label>
                    <input
                      id="sales-lead-address"
                      required
                      autoComplete="street-address"
                      value={leadForm.propertyAddress}
                      onChange={(event) => setLeadForm((current) => ({ ...current, propertyAddress: event.target.value }))}
                      className={craftInput}
                      placeholder="Street, city"
                    />
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="sales-lead-phone" className={craftLabel}>Mobile phone</label>
                    <input
                      id="sales-lead-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={leadForm.phone ?? ""}
                      onChange={(event) => setLeadForm((current) => ({ ...current, phone: event.target.value }))}
                      className={craftInput}
                      placeholder="(555) 555-5555"
                    />
                  </div>
                  <div>
                    <label htmlFor="sales-lead-email" className={craftLabel}>Email</label>
                    <input
                      id="sales-lead-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={leadForm.email ?? ""}
                      onChange={(event) => setLeadForm((current) => ({ ...current, email: event.target.value }))}
                      className={craftInput}
                      placeholder="homeowner@email.com"
                    />
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="sales-lead-arr" className={craftLabel}>Estimated annual value</label>
                    <input
                      id="sales-lead-arr"
                      type="number"
                      min="0"
                      step="50"
                      inputMode="decimal"
                      value={leadForm.estimatedArrDollars ?? ""}
                      onChange={(event) => setLeadForm((current) => ({ ...current, estimatedArrDollars: Number(event.target.value) }))}
                      className={craftInput}
                    />
                  </div>
                  <div>
                    <label htmlFor="sales-lead-follow-up" className={craftLabel}>Next check-in</label>
                    <input
                      id="sales-lead-follow-up"
                      type="datetime-local"
                      value={leadForm.nextFollowUpAt ?? ""}
                      onChange={(event) => setLeadForm((current) => ({ ...current, nextFollowUpAt: event.target.value }))}
                      className={craftInput}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="sales-lead-notes" className={craftLabel}>Doorstep notes</label>
                  <textarea
                    id="sales-lead-notes"
                    rows={3}
                    value={leadForm.notes ?? ""}
                    onChange={(event) => setLeadForm((current) => ({ ...current, notes: event.target.value }))}
                    className={craftTextarea}
                    placeholder="What matters to them? What should the team remember?"
                  />
                </div>

                <fieldset className="space-y-3 rounded-2xl border border-white/[0.07] bg-black/10 p-4">
                  <legend className="px-2 text-[10px] uppercase tracking-[0.2em] text-muted">Customer permission</legend>
                  <label className="flex min-h-12 cursor-pointer items-start gap-3 text-xs leading-5 text-foreground/75">
                    <input
                      type="checkbox"
                      checked={leadForm.smsConsentAttested === true}
                      onChange={(event) => setLeadForm((current) => ({ ...current, smsConsentAttested: event.target.checked }))}
                      className="mt-1 h-4 w-4 accent-[#c9b896]"
                    />
                    Customer gave SqueegeeKing permission to text this number about
                    this request and service follow-ups. Message/data rates may apply;
                    reply STOP to opt out.
                  </label>
                  <label className="flex min-h-12 cursor-pointer items-start gap-3 text-xs leading-5 text-foreground/75">
                    <input
                      type="checkbox"
                      checked={leadForm.emailConsentAttested === true}
                      onChange={(event) => setLeadForm((current) => ({ ...current, emailConsentAttested: event.target.checked }))}
                      className="mt-1 h-4 w-4 accent-[#c9b896]"
                    />
                    Customer agreed to receive service and follow-up email about this request.
                  </label>
                  <p className="text-[10px] leading-4 text-muted/65">
                    Leave unchecked when permission was not explicit. Saving a check-in
                    does not automatically send a message.
                  </p>
                </fieldset>

                {error ? <p className="text-sm text-red-200" role="alert">{error}</p> : null}

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button type="button" onClick={() => setLeadFormOpen(false)} className={craftSecondaryButton}>
                    Cancel
                  </button>
                  <button type="submit" disabled={leadSaving} className={craftPrimaryButton}>
                    {leadSaving ? "Saving…" : "Save homeowner"}
                  </button>
                </div>
              </form>
            </GlassCard>
          </div>
        </div>
      ) : null}
    </AmbientStage>
  );
}
