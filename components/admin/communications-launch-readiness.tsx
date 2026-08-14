"use client";

import { useCallback, useEffect, useState } from "react";
import { GlassCard } from "@/components/craft/glass-card";
import { ShimmerBlock } from "@/components/motion/shimmer-block";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import type {
  CommunicationsLaunchReadiness,
  IntegrationLaunchCard,
  IntegrationLaunchState,
  IntegrationLaunchStepStatus,
} from "@/lib/communications/integration-launch-readiness-core";
import { craftEyebrow } from "@/lib/craft/tokens";

const STATE_LABELS: Record<IntegrationLaunchState, string> = {
  ready: "Ready",
  waiting: "Waiting",
  needs_action: "Needs action",
};

const STATE_TONES: Record<IntegrationLaunchState, string> = {
  ready: "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-200",
  waiting: "border-sky-300/20 bg-sky-300/[0.07] text-sky-100",
  needs_action: "border-amber-300/20 bg-amber-300/[0.07] text-amber-100",
};

const STEP_DOTS: Record<IntegrationLaunchStepStatus, string> = {
  complete: "bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.35)]",
  waiting: "bg-sky-300 shadow-[0_0_12px_rgba(125,211,252,0.3)]",
  needs_action: "bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.3)]",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function errorMessage(value: unknown, fallback: string): string {
  const record = asRecord(value);
  return typeof record?.error === "string" && record.error.trim()
    ? record.error.trim()
    : fallback;
}

function isLaunchReadiness(value: unknown): value is CommunicationsLaunchReadiness {
  const record = asRecord(value);
  return Boolean(
    record &&
      asRecord(record.twilio) &&
      asRecord(record.meta) &&
      asRecord(record.scheduler),
  );
}

function LaunchCard({
  card,
  copiedUrl,
  onCopy,
}: {
  card: IntegrationLaunchCard;
  copiedUrl: string | null;
  onCopy: (url: string) => void;
}) {
  const progress = Math.round((card.completedSteps / card.totalSteps) * 100);

  return (
    <article className="overflow-hidden rounded-[1.35rem] border border-white/[0.075] bg-black/[0.13]">
      <div className="border-b border-white/[0.06] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-serif text-xl font-light text-foreground">
              {card.label}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {card.summary}
            </p>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-[9px] uppercase tracking-[0.15em] ${STATE_TONES[card.state]}`}
          >
            {STATE_LABELS[card.state]}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]"
            role="progressbar"
            aria-label={`${card.label} setup progress`}
            aria-valuemin={0}
            aria-valuemax={card.totalSteps}
            aria-valuenow={card.completedSteps}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent/70 to-emerald-300/80 transition-[width] duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="shrink-0 text-[10px] tabular-nums text-muted/75">
            {card.completedSteps}/{card.totalSteps}
          </span>
        </div>
      </div>

      <ol className="space-y-0 px-5 py-2">
        {card.steps.map((step) => (
          <li
            key={step.id}
            className="grid grid-cols-[auto_1fr] gap-3 border-b border-white/[0.05] py-3 last:border-b-0"
          >
            <span
              aria-hidden
              className={`mt-1.5 h-2 w-2 rounded-full ${STEP_DOTS[step.status]}`}
            />
            <div>
              <p className="text-xs font-medium text-foreground/90">
                {step.label}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted/80">
                {step.detail}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="space-y-3 border-t border-white/[0.06] bg-white/[0.018] p-5">
        {card.callbackUrls.map((callback) => (
          <div key={callback.url}>
            <p className="text-[9px] uppercase tracking-[0.14em] text-muted/65">
              {callback.label}
            </p>
            <div className="mt-1.5 flex items-start gap-2 rounded-xl border border-white/[0.065] bg-black/20 p-3">
              <code className="min-w-0 flex-1 select-all break-all text-[10px] leading-relaxed text-foreground/75">
                {callback.url}
              </code>
              <button
                type="button"
                onClick={() => onCopy(callback.url)}
                className="shrink-0 text-[9px] uppercase tracking-[0.13em] text-accent hover:text-accent/80"
              >
                {copiedUrl === callback.url ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        ))}
        <a
          href={card.actionUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-9 items-center justify-center rounded-full border border-accent/20 bg-accent/[0.065] px-4 text-[9px] uppercase tracking-[0.15em] text-accent transition-colors hover:bg-accent/[0.1]"
        >
          {card.actionLabel}
        </a>
      </div>
    </article>
  );
}

export function CommunicationsLaunchReadinessPanel() {
  const [readiness, setReadiness] =
    useState<CommunicationsLaunchReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const loadReadiness = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/communications/readiness", {
        headers: getAdminRequestHeaders(),
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        throw new Error(
          errorMessage(body, "Communications setup could not be checked."),
        );
      }
      if (!isLaunchReadiness(body)) {
        throw new Error("Atlas returned an incomplete communications check.");
      }
      setReadiness(body);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Communications setup could not be checked.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadReadiness();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadReadiness]);

  const copyUrl = useCallback((url: string) => {
    if (!navigator.clipboard) {
      setError("Clipboard access is unavailable. Select and copy the URL manually.");
      return;
    }
    void navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopiedUrl(url);
        window.setTimeout(() => setCopiedUrl(null), 1_800);
      })
      .catch(() => {
        setError("Clipboard access was blocked. Select and copy the URL manually.");
      });
  }, []);

  return (
    <GlassCard
      as="section"
      tone="subtle"
      padding="none"
      motion="rise"
      className="mb-4 overflow-hidden"
    >
      <div className="flex flex-col gap-4 border-b border-white/[0.06] px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className={craftEyebrow}>Activation runway</p>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[9px] uppercase tracking-[0.14em] text-muted">
              Read only
            </span>
          </div>
          <h2 className="mt-2 font-serif text-2xl font-light text-foreground">
            Make every connection provable
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Atlas separates credentials, provider approval, signed callbacks,
            and a real end-to-end proof. Checking this panel never sends a
            message or changes an automation rule.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadReadiness()}
          disabled={loading}
          className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.035] px-4 text-[10px] uppercase tracking-[0.14em] text-muted transition-colors hover:border-accent/25 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Checking..." : "Refresh status"}
        </button>
      </div>

      <div className="p-4 sm:p-5">
        {error ? (
          <div
            role="alert"
            className="mb-4 rounded-[1rem] border border-red-300/15 bg-red-300/[0.055] px-4 py-3 text-xs leading-relaxed text-red-100"
          >
            {error}
          </div>
        ) : null}

        {loading && !readiness ? (
          <div className="grid gap-4 lg:grid-cols-2" aria-label="Checking integrations">
            <ShimmerBlock className="h-[29rem] rounded-[1.35rem]" />
            <ShimmerBlock className="h-[29rem] rounded-[1.35rem]" />
          </div>
        ) : readiness ? (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <LaunchCard
                card={readiness.twilio}
                copiedUrl={copiedUrl}
                onCopy={copyUrl}
              />
              <LaunchCard
                card={readiness.meta}
                copiedUrl={copiedUrl}
                onCopy={copyUrl}
              />
            </div>
            <div className="mt-4 flex flex-col gap-3 rounded-[1.1rem] border border-white/[0.065] bg-white/[0.025] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    readiness.scheduler.state === "ready"
                      ? STEP_DOTS.complete
                      : STEP_DOTS.needs_action
                  }`}
                />
                <div>
                  <p className="text-xs font-medium text-foreground/90">
                    {readiness.scheduler.label}
                  </p>
                  <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-muted/80">
                    {readiness.scheduler.detail}
                  </p>
                </div>
              </div>
              <code className="shrink-0 text-[10px] text-muted/65">
                {readiness.scheduler.route}
              </code>
            </div>
          </>
        ) : (
          <p className="py-8 text-center text-sm text-muted">
            Integration status is unavailable right now.
          </p>
        )}
      </div>
    </GlassCard>
  );
}
