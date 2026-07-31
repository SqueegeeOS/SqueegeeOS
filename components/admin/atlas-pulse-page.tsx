"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { HqFounderNav } from "@/components/admin/hq-founder-nav";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { GlassCard } from "@/components/craft/glass-card";
import { MotionReveal } from "@/components/craft/motion-reveal";
import { ShimmerBlock } from "@/components/motion/shimmer-block";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { isAdminUnlocked } from "@/lib/admin/pin";
import type {
  AtlasPulseAction,
  AtlasPulseCustomer,
  AtlasPulseDashboard,
  AtlasPulseIntegration,
  AtlasPulseMatchSuggestion,
  AtlasPulseUniversalSearchResult,
} from "@/lib/activation/atlas-pulse-types";
import {
  craftEyebrow,
  craftHeading,
  craftInput,
  craftPrimaryButton,
  craftSecondaryButton,
} from "@/lib/craft/tokens";

type JourneyFilter = "attention" | "all" | "complete";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function IntegrationPill({ item }: { item: AtlasPulseIntegration }) {
  const tone =
    item.status === "healthy"
      ? "border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-200"
      : item.status === "attention"
        ? "border-amber-500/25 bg-amber-500/[0.07] text-amber-100"
        : "border-red-500/25 bg-red-500/[0.07] text-red-200";
  const dot =
    item.status === "healthy"
      ? "bg-emerald-400"
      : item.status === "attention"
        ? "bg-amber-400"
        : "bg-red-400";
  const href =
    item.id === "jobber"
      ? "/hq/jobber"
      : item.id === "resend" || item.id === "deployment"
        ? "/hq/production-health"
        : null;
  const classes = `group relative min-w-0 rounded-2xl border px-4 py-3.5 transition-[border-color,background-color,transform] duration-300 ${tone} ${
    href ? "hover:-translate-y-0.5 hover:border-accent/30" : ""
  }`;
  const content = (
    <>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
        <span className="text-xs font-medium">{item.label}</span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-[10px] leading-relaxed opacity-70">
        {item.message}
      </p>
      {href ? (
        <span className="mt-2 inline-flex items-center gap-1 text-[9px] font-medium uppercase tracking-[0.16em] opacity-55 transition-opacity group-hover:opacity-90">
          Open <span aria-hidden>→</span>
        </span>
      ) : null}
    </>
  );

  return href ? (
    <Link
      href={href}
      className={classes}
      title={[item.message, item.detail].filter(Boolean).join(" · ")}
      aria-label={`${item.label}: ${item.message}. Open details.`}
    >
      {content}
    </Link>
  ) : (
    <div
      className={classes}
      title={[item.message, item.detail].filter(Boolean).join(" · ")}
    >
      {content}
    </div>
  );
}

function StageRail({ customer }: { customer: AtlasPulseCustomer }) {
  return (
    <div
      className="grid grid-cols-4 gap-x-1.5 gap-y-3 sm:grid-cols-8"
      aria-label="Activation journey"
    >
      {customer.stages.map((stage) => {
        const stageClass =
          stage.status === "complete"
            ? "bg-emerald-400/75"
            : stage.status === "attention"
              ? "bg-amber-300/80"
              : "bg-white/10";
        return (
          <div key={stage.id} className="min-w-0">
            <div
              className={`h-1.5 rounded-full ${stageClass}`}
              title={`${stage.label}: ${stage.detail}`}
            />
            <p className="mt-1.5 truncate text-[8px] uppercase tracking-[0.1em] text-muted/70">
              {stage.label.replace(" delivered", "")}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function MatchSuggestion({
  suggestion,
  approving,
  onApprove,
}: {
  suggestion: AtlasPulseMatchSuggestion;
  approving: boolean;
  onApprove: (suggestion: AtlasPulseMatchSuggestion) => void;
}) {
  const confidenceTone =
    suggestion.confidence === "high"
      ? "text-emerald-300"
      : suggestion.confidence === "likely"
        ? "text-accent"
        : "text-amber-200";
  return (
    <div className="rounded-2xl border border-border/80 bg-black/15 p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <p className="text-sm text-foreground">
            {suggestion.jobberName}
            <span className="mx-2 text-muted/40">→</span>
            {suggestion.homeownerName}
          </p>
          <p className="mt-1 text-xs text-muted">
            {suggestion.reasons.join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className={`text-xs capitalize ${confidenceTone}`}>
            {suggestion.confidence} · {suggestion.score}%
          </span>
          <button
            type="button"
            disabled={approving}
            onClick={() => onApprove(suggestion)}
            className="rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-xs text-accent transition hover:bg-accent/15 disabled:opacity-50"
          >
            {approving ? "Pairing…" : "Approve match"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomerJourneyCard({
  customer,
  busyAction,
  feedback,
  onAction,
  defaultExpanded = false,
}: {
  customer: AtlasPulseCustomer;
  busyAction: string | null;
  feedback: string | null;
  onAction: (customer: AtlasPulseCustomer, action: AtlasPulseAction) => void;
  defaultExpanded?: boolean;
}) {
  const needsAttention = customer.exceptionCodes.length > 0;
  const founderConfirmed =
    customer.manualCompletion.emailComplete &&
    customer.manualCompletion.portalComplete;
  const [expanded, setExpanded] = useState(defaultExpanded);
  const detailId = `journey-${customer.recordKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return (
    <article
      className={`rounded-[1.65rem] border p-5 sm:p-6 ${
        needsAttention
          ? "border-amber-500/20 bg-amber-500/[0.025]"
          : "border-border/80 bg-background/35"
      }`}
    >
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-2xl font-light text-foreground">
              {customer.homeownerName}
            </h3>
            <span className="rounded-full border border-border px-2.5 py-1 text-[9px] uppercase tracking-[0.14em] text-muted">
              {customer.source}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] ${
                needsAttention
                  ? "bg-amber-500/10 text-amber-200"
                  : "bg-emerald-500/10 text-emerald-200"
              }`}
            >
              {customer.completionPercent}% ready
            </span>
          </div>
          <p className="mt-2 text-sm text-muted">{customer.propertyLabel}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted/80">
            {customer.email ? <span>{customer.email}</span> : null}
            {customer.phone ? <span>{customer.phone}</span> : null}
            <span>{customer.planType}</span>
            {customer.yearlyValue != null ? (
              <span>{formatCurrency(customer.yearlyValue)}/yr</span>
            ) : null}
          </div>
        </div>
        <div className="min-w-[12rem] rounded-2xl border border-border/70 bg-black/15 px-4 py-3">
          <p className={craftEyebrow}>Next move</p>
          <p className="mt-2 text-sm text-foreground">{customer.nextActionLabel}</p>
        </div>
      </div>

      <div className="mt-6">
        <StageRail customer={customer} />
      </div>

      <div className="mt-4 flex flex-col justify-between gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center">
        <p className="text-xs leading-relaxed text-muted/75">
          {expanded
            ? "Portal evidence, customer actions, and care opportunities."
            : `${customer.actions.length} action${customer.actions.length === 1 ? "" : "s"} ready · open only when you need the full dossier.`}
        </p>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={detailId}
          onClick={() => setExpanded((current) => !current)}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-accent/20 bg-accent/[0.055] px-4 text-[10px] font-medium uppercase tracking-[0.16em] text-accent transition-[border-color,background-color,transform] hover:border-accent/35 hover:bg-accent/[0.09] active:scale-[0.98]"
        >
          {expanded ? "Close dossier" : "Open dossier"}
          <span
            aria-hidden
            className={`text-sm transition-transform duration-300 ${expanded ? "rotate-45" : ""}`}
          >
            +
          </span>
        </button>
      </div>

      {expanded ? (
      <div
        id={detailId}
        className="hq-card-reveal mt-5 grid gap-4 lg:grid-cols-[1.35fr_1fr]"
      >
        <div className="rounded-2xl border border-border/60 bg-black/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className={craftEyebrow}>Home Passport</p>
            <span className="text-[10px] text-muted">
              Updated {formatDate(customer.updatedAt)}
            </span>
          </div>
          <div className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
            <div>
              <p className="text-muted">Portal access</p>
              <p className="mt-1 text-foreground">
                {customer.manualCompletion.portalComplete
                  ? "Founder confirmed"
                  : customer.portalUrl
                    ? "Link ready, unconfirmed"
                    : "Not ready"}
              </p>
              {customer.manualCompletion.portalConfirmedAt ? (
                <p className="mt-1 text-[10px] text-muted/70">
                  {formatDate(customer.manualCompletion.portalConfirmedAt)}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-muted">Welcome email</p>
              <p className="mt-1 capitalize text-foreground">
                {customer.manualCompletion.emailComplete
                  ? "Founder confirmed"
                  : customer.welcomeDeliveryStatus ?? "Untracked"}
              </p>
              {customer.manualCompletion.emailComplete ? (
                <p className="mt-1 text-[10px] capitalize text-muted/70">
                  Resend: {customer.welcomeDeliveryStatus ?? "untracked"}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-muted">Jobber</p>
              <p className="mt-1 text-foreground">
                {customer.jobber.linked
                  ? customer.jobber.clientName ?? "Paired"
                  : customer.jobber.suggestedMatch
                    ? `${customer.jobber.suggestedMatch.confidence} match found`
                    : "Not paired"}
              </p>
            </div>
          </div>
          {founderConfirmed ? (
            <p className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-3 py-2 text-[10px] leading-relaxed text-emerald-100/80">
              Founder-confirmed handoff. Resend delivery evidence remains separate.
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {customer.actions.map((action) => {
              if (action.kind === "open_link" || action.kind === "pair_jobber") {
                return (
                  <Link
                    key={action.id}
                    href={action.href ?? "/hq"}
                    className={
                      action.primary
                        ? "rounded-full bg-accent px-4 py-2 text-xs font-medium text-background"
                        : "rounded-full border border-border px-4 py-2 text-xs text-muted transition hover:text-foreground"
                    }
                  >
                    {action.label}
                  </Link>
                );
              }
              if (action.kind === "open_jobber") {
                return (
                  <a
                    key={action.id}
                    href={action.href}
                    target="_blank"
                    rel="noreferrer"
                    className={
                      action.primary
                        ? "rounded-full bg-accent px-4 py-2 text-xs font-medium text-background"
                        : "rounded-full border border-border px-4 py-2 text-xs text-muted transition hover:text-foreground"
                    }
                  >
                    {action.label}
                  </a>
                );
              }
              const actionKey = `${customer.recordKey}:${action.id}`;
              return (
                <button
                  key={action.id}
                  type="button"
                  disabled={busyAction === actionKey}
                  onClick={() => onAction(customer, action)}
                  className="rounded-full border border-border px-4 py-2 text-xs text-muted transition hover:border-accent/30 hover:text-foreground disabled:opacity-50"
                >
                  {busyAction === actionKey ? "Working…" : action.label}
                </button>
              );
            })}
          </div>
          {feedback ? (
            <p className="mt-3 text-xs text-accent" aria-live="polite">
              {feedback}
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-border/60 bg-black/10 p-4">
          <p className={craftEyebrow}>Care forecast</p>
          {customer.opportunities.length > 0 ? (
            <div className="mt-3 space-y-3">
              {customer.opportunities.map((opportunity) => (
                <div key={opportunity.id} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-foreground">{opportunity.label}</p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
                      {opportunity.reason}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] text-accent">
                    {opportunity.priceLabel}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted">
              Forecast begins when a membership is active.
            </p>
          )}
        </div>
      </div>
      ) : null}
    </article>
  );
}

function SearchResults({
  result,
}: {
  result: AtlasPulseUniversalSearchResult;
}) {
  if (result.homeAtlas.length === 0 && result.jobber.length === 0) {
    return (
      <p className="mt-4 text-sm text-muted">
        No HomeAtlas or Jobber customer matched “{result.search}”.
      </p>
    );
  }
  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <div>
        <p className={craftEyebrow}>HomeAtlas</p>
        <div className="mt-3 space-y-2">
          {result.homeAtlas.map((customer) => (
            <Link
              key={customer.homeownerId}
              href={`/hq/customers/homeowner/${encodeURIComponent(customer.homeownerId)}`}
              className="block rounded-xl border border-border/70 bg-black/10 px-4 py-3 transition hover:border-accent/25"
            >
              <p className="text-sm text-foreground">{customer.name}</p>
              <p className="mt-1 truncate text-xs text-muted">
                {customer.email ?? customer.phone ?? customer.properties[0] ?? "No contact detail"}
              </p>
            </Link>
          ))}
        </div>
      </div>
      <div>
        <p className={craftEyebrow}>Jobber</p>
        <div className="mt-3 space-y-2">
          {result.jobber.map((customer) => (
            <a
              key={customer.externalClientId}
              href={customer.webUri}
              target="_blank"
              rel="noreferrer"
              className="block rounded-xl border border-border/70 bg-black/10 px-4 py-3 transition hover:border-accent/25"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-foreground">{customer.name}</p>
                <span className="text-[10px] text-muted">
                  {customer.linkedHomeownerName
                    ? `Paired to ${customer.linkedHomeownerName}`
                    : "Unpaired"}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-muted">
                {customer.email ?? customer.phone ?? "Open in Jobber"}
              </p>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function LoadingDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <ShimmerBlock key={index} className="h-24 rounded-2xl" />
        ))}
      </div>
      <ShimmerBlock className="h-64 rounded-[1.75rem]" />
      <ShimmerBlock className="h-96 rounded-[1.75rem]" />
    </div>
  );
}

function AtlasPulseContent() {
  const [data, setData] = useState<AtlasPulseDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<JourneyFilter>("attention");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<Record<string, string>>({});
  const [approvingMatch, setApprovingMatch] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [queueSearch, setQueueSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] =
    useState<AtlasPulseUniversalSearchResult | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/admin/activation", {
        headers: getAdminRequestHeaders(),
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as
        | (AtlasPulseDashboard & { error?: string })
        | null;
      if (!response.ok || !body) {
        throw new Error(body?.error ?? "Atlas Pulse could not load");
      }
      setData(body);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Atlas Pulse could not load",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredCustomers = useMemo(() => {
    if (!data) return [];
    let customers =
      filter === "attention"
        ? data.customers.filter((customer) => customer.exceptionCodes.length > 0)
        : filter === "complete"
          ? data.customers.filter((customer) => customer.completionPercent === 100)
          : data.customers;
    const query = queueSearch.trim().toLocaleLowerCase();
    if (query) {
      customers = customers.filter((customer) =>
        [
          customer.homeownerName,
          customer.email,
          customer.phone,
          customer.propertyLabel,
          customer.planType,
          customer.nextActionLabel,
        ]
          .filter(Boolean)
          .some((value) => value?.toLocaleLowerCase().includes(query)),
      );
    }
    return [...customers].sort((left, right) => {
      const completionDelta = right.completionPercent - left.completionPercent;
      if (completionDelta !== 0) return completionDelta;
      return (
        (Date.parse(right.updatedAt ?? "") || 0) -
        (Date.parse(left.updatedAt ?? "") || 0)
      );
    });
  }, [data, filter, queueSearch]);

  const performAction = async (
    customer: AtlasPulseCustomer,
    action: AtlasPulseAction,
  ) => {
    const actionKey = `${customer.recordKey}:${action.id}`;
    setBusyAction(actionKey);
    setActionFeedback((current) => ({ ...current, [customer.recordKey]: "" }));
    try {
      if (action.kind === "copy_portal" && action.portalUrl) {
        const absolute = new URL(action.portalUrl, window.location.origin).toString();
        await navigator.clipboard.writeText(absolute);
        setActionFeedback((current) => ({
          ...current,
          [customer.recordKey]: "Verified portal link copied.",
        }));
        return;
      }
      if (action.kind === "resend_welcome" && action.membershipId) {
        const response = await fetch(
          `/api/admin/memberships/${encodeURIComponent(action.membershipId)}/resend-welcome`,
          { method: "POST", headers: getAdminRequestHeaders() },
        );
        const body = (await response.json().catch(() => null)) as
          | { message?: string; error?: string }
          | null;
        if (!response.ok) {
          throw new Error(body?.error ?? "Welcome email was not sent");
        }
        setActionFeedback((current) => ({
          ...current,
          [customer.recordKey]: body?.message ?? "Welcome email sent.",
        }));
        await load();
        return;
      }
      if (
        action.kind === "set_manual_completion" &&
        action.membershipId &&
        typeof action.completed === "boolean"
      ) {
        if (
          !action.completed &&
          !window.confirm(
            "Undo the founder confirmation? Resend delivery evidence will stay unchanged.",
          )
        ) {
          return;
        }
        const response = await fetch(
          "/api/admin/activation/manual-completion",
          {
            method: "POST",
            headers: getAdminRequestHeaders(),
            body: JSON.stringify({
              membershipId: action.membershipId,
              completed: action.completed,
            }),
          },
        );
        const body = (await response.json().catch(() => null)) as
          | { message?: string; error?: string }
          | null;
        if (!response.ok) {
          throw new Error(body?.error ?? "Founder confirmation was not changed");
        }
        setActionFeedback((current) => ({
          ...current,
          [customer.recordKey]: body?.message ?? "Founder confirmation updated.",
        }));
        await load();
      }
    } catch (actionError) {
      setActionFeedback((current) => ({
        ...current,
        [customer.recordKey]:
          actionError instanceof Error ? actionError.message : "Action did not finish",
      }));
    } finally {
      setBusyAction(null);
    }
  };

  const approveMatch = async (suggestion: AtlasPulseMatchSuggestion) => {
    setApprovingMatch(suggestion.externalClientId);
    setError(null);
    try {
      const response = await fetch(
        "/api/admin/care-operations/jobber/customers",
        {
          method: "POST",
          headers: getAdminRequestHeaders(),
          body: JSON.stringify({
            action: "link",
            externalClientId: suggestion.externalClientId,
            homeownerId: suggestion.homeownerId,
            sameCustomerConfirmed: true,
          }),
        },
      );
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Customer pairing did not finish");
      }
      await load();
    } catch (matchError) {
      setError(
        matchError instanceof Error ? matchError.message : "Customer pairing failed",
      );
    } finally {
      setApprovingMatch(null);
    }
  };

  const submitSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = search.trim();
    if (query.length < 2) {
      setSearchResult(null);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const params = new URLSearchParams({ mode: "search", search: query });
      const response = await fetch(`/api/admin/activation?${params.toString()}`, {
        headers: getAdminRequestHeaders(),
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as
        | (AtlasPulseUniversalSearchResult & { error?: string })
        | null;
      if (!response.ok || !body) {
        throw new Error(body?.error ?? "Customer search failed");
      }
      setSearchResult(body);
    } catch (searchError) {
      setError(
        searchError instanceof Error ? searchError.message : "Customer search failed",
      );
    } finally {
      setSearching(false);
    }
  };

  const metrics = data
    ? [
        { label: "Journeys", value: String(data.summary.totalJourneys) },
        { label: "Complete", value: String(data.summary.completedJourneys) },
        { label: "Needs action", value: String(data.summary.needsAttention), warn: true },
        { label: "Jobber unpaired", value: String(data.summary.unpairedJobber) },
        { label: "Need scheduling", value: String(data.summary.unscheduledMembers) },
        { label: "Revenue radar", value: formatCurrency(data.summary.revenueRadar), accent: true },
      ]
    : [];

  return (
    <AmbientStage className="px-4 py-10 text-foreground sm:px-6 sm:py-12">
      <div className="relative mx-auto max-w-7xl">
        <HqFounderNav />

        <MotionReveal className="mb-8 mt-10">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <p className={craftEyebrow}>Exception-driven control tower</p>
              <h1 className={`${craftHeading} mt-3 text-4xl sm:text-5xl`}>
                Atlas Pulse
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-[1.7] text-muted">
                Every customer from first contact to the next scheduled visit —
                with one clear rescue action whenever the journey breaks.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className={craftSecondaryButton}
            >
              Refresh live data
            </button>
          </div>
        </MotionReveal>

        {loading ? <LoadingDashboard /> : null}

        {!loading && error ? (
          <div className="mb-6 rounded-2xl border border-red-500/25 bg-red-500/[0.06] px-5 py-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {!loading && data ? (
          <div className="space-y-8">
            <section aria-labelledby="atlas-live-systems">
              <div className="mb-3 flex items-end justify-between gap-4">
                <div>
                  <p className={craftEyebrow}>Live systems</p>
                  <h2
                    id="atlas-live-systems"
                    className="mt-1.5 font-serif text-xl font-light text-foreground"
                  >
                    The operating layer
                  </h2>
                </div>
                <p className="hidden text-[10px] uppercase tracking-[0.16em] text-muted/60 sm:block">
                  Warnings open their control room
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {data.integrations.map((item) => (
                  <IntegrationPill key={item.id} item={item} />
                ))}
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="group relative overflow-hidden rounded-2xl border border-border/80 bg-background/40 p-5 transition-[border-color,background-color,transform] duration-300 hover:-translate-y-0.5 hover:border-accent/20 hover:bg-background/[0.55]"
                >
                  <span
                    className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden
                  />
                  <p className={craftEyebrow}>{metric.label}</p>
                  <p
                    className={`mt-2 font-serif text-3xl font-light tabular-nums ${
                      metric.warn && Number(metric.value) > 0
                        ? "text-amber-200"
                        : metric.accent
                          ? "text-accent"
                          : "text-foreground"
                    }`}
                  >
                    {metric.value}
                  </p>
                </div>
              ))}
            </div>

            <GlassCard as="section" tone="elevated" padding="lg" rim motion="none">
              <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                <div>
                  <p className={craftEyebrow}>Universal customer search</p>
                  <h2 className="mt-2 font-serif text-2xl font-light text-foreground">
                    One search across HomeAtlas + Jobber
                  </h2>
                </div>
                <form onSubmit={submitSearch} className="flex w-full max-w-xl gap-2">
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Name, email, phone, address…"
                    className={craftInput}
                    aria-label="Search HomeAtlas and Jobber customers"
                  />
                  <button
                    type="submit"
                    disabled={searching || search.trim().length < 2}
                    className={`${craftPrimaryButton} min-h-[48px] px-5`}
                  >
                    {searching ? "Searching…" : "Search"}
                  </button>
                </form>
              </div>
              {searchResult ? <SearchResults result={searchResult} /> : null}
            </GlassCard>

            {data.matchSuggestions.length > 0 ? (
              <GlassCard as="section" tone="subtle" padding="lg" motion="none">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                  <div>
                    <p className={craftEyebrow}>Smart matchmaker</p>
                    <h2 className="mt-2 font-serif text-2xl font-light text-foreground">
                      Likely Jobber ↔ HomeAtlas pairs
                    </h2>
                    <p className="mt-2 text-sm text-muted">
                      Suggestions only. You approve every identity link.
                    </p>
                  </div>
                  <Link href="/hq/jobber" className="text-xs text-accent hover:underline">
                    Open full pairing workspace
                  </Link>
                </div>
                <div className="mt-5 space-y-3">
                  {data.matchSuggestions.map((suggestion) => (
                    <MatchSuggestion
                      key={suggestion.externalClientId}
                      suggestion={suggestion}
                      approving={approvingMatch === suggestion.externalClientId}
                      onApprove={(item) => void approveMatch(item)}
                    />
                  ))}
                </div>
              </GlassCard>
            ) : null}

            <section>
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
                <div>
                  <p className={craftEyebrow}>Activation inbox</p>
                  <h2 className="mt-2 font-serif text-3xl font-light text-foreground">
                    Customer journeys
                  </h2>
                  <p className="mt-2 text-xs text-muted/70">
                    Closest to the finish line first, so every action closes a loop.
                  </p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-3xl lg:justify-end">
                  <label className="relative min-w-0 flex-1 sm:max-w-xs">
                    <span className="sr-only">Filter customer journeys</span>
                    <input
                      value={queueSearch}
                      onChange={(event) => setQueueSearch(event.target.value)}
                      placeholder="Filter this queue…"
                      className={`${craftInput} min-h-[42px] py-2.5 pr-9`}
                    />
                    {queueSearch ? (
                      <button
                        type="button"
                        onClick={() => setQueueSearch("")}
                        aria-label="Clear queue filter"
                        className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-sm text-muted transition hover:bg-white/[0.05] hover:text-foreground"
                      >
                        ×
                      </button>
                    ) : null}
                  </label>
                  <div
                    className="flex shrink-0 gap-1 rounded-[1rem] border border-border/70 bg-black/10 p-1"
                    role="group"
                    aria-label="Journey filter"
                  >
                    {(
                      [
                        ["attention", "Action", data.summary.needsAttention],
                        ["all", "All", data.summary.totalJourneys],
                        ["complete", "Done", data.summary.completedJourneys],
                      ] as const
                    ).map(([value, label, count]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFilter(value)}
                        className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[10px] font-medium uppercase tracking-[0.1em] transition ${
                          filter === value
                            ? "bg-accent/[0.12] text-accent shadow-[inset_0_0_0_1px_rgba(201,184,150,0.18)]"
                            : "text-muted hover:text-foreground"
                        }`}
                      >
                        {label}
                        <span className="text-[9px] opacity-60">{count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-4 border-y border-border/50 py-3 text-[10px] uppercase tracking-[0.14em] text-muted/60">
                <span>
                  {filteredCustomers.length} {filteredCustomers.length === 1 ? "journey" : "journeys"}
                </span>
                <span>{queueSearch ? `Matching “${queueSearch.trim()}”` : "Priority ranked"}</span>
              </div>

              <div className="mt-5 space-y-4">
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map((customer, index) => (
                    <CustomerJourneyCard
                      key={customer.recordKey}
                      customer={customer}
                      busyAction={busyAction}
                      feedback={actionFeedback[customer.recordKey] ?? null}
                      onAction={(current, action) => void performAction(current, action)}
                      defaultExpanded={index === 0}
                    />
                  ))
                ) : (
                  <div className="rounded-[1.65rem] border border-border/80 bg-background/35 p-8 text-center">
                    <p className="text-sm text-muted">
                      {filter === "attention"
                        ? "No customer journeys need rescue."
                        : "No journeys match this view yet."}
                    </p>
                  </div>
                )}
              </div>
            </section>

            {data.dataNotes.length > 0 ? (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] px-5 py-4">
                <p className={craftEyebrow}>Activation notes</p>
                <ul className="mt-2 space-y-1 text-xs leading-relaxed text-amber-100/80">
                  {data.dataNotes.map((note) => (
                    <li key={note}>· {note}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <p className="text-xs text-muted/60">
              Live snapshot loaded {formatDate(data.loadedAt)}
            </p>
          </div>
        ) : null}
      </div>
    </AmbientStage>
  );
}

export function AtlasPulsePage() {
  const [unlocked, setUnlocked] = useState(() => isAdminUnlocked());
  if (!unlocked) {
    return <AdminPinGate onUnlock={() => setUnlocked(true)} />;
  }
  return <AtlasPulseContent />;
}
