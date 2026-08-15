"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GlassCard } from "@/components/craft/glass-card";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import type {
  OwnerAttentionItem,
  OwnerAttentionPriority,
  OwnerAttentionResponse,
} from "@/lib/admin/owner-attention";
import { craftEyebrow, craftHeading } from "@/lib/craft/tokens";

const PRIORITY_STYLE: Record<
  OwnerAttentionPriority,
  { label: string; badge: string; card: string; dot: string }
> = {
  critical: {
    label: "Critical",
    badge: "border-red-400/35 bg-red-400/10 text-red-100",
    card: "border-red-400/25 bg-red-400/[0.045]",
    dot: "bg-red-300",
  },
  high: {
    label: "Next",
    badge: "border-amber-300/35 bg-amber-300/10 text-amber-100",
    card: "border-amber-300/20 bg-amber-300/[0.035]",
    dot: "bg-amber-200",
  },
  normal: {
    label: "Build",
    badge: "border-sky-300/25 bg-sky-300/[0.08] text-sky-100",
    card: "border-border/70 bg-background/45",
    dot: "bg-sky-200",
  },
};

const DOMAIN_LABELS: Record<OwnerAttentionItem["domain"], string> = {
  leads: "Lead",
  sales: "Sales",
  dispatch: "Dispatch",
  field: "Field",
  billing: "Billing",
  communications: "Communications",
  growth: "Growth",
  systems: "Systems",
};

function generatedLabel(value: string): string {
  const generatedAt = new Date(value);
  if (!Number.isFinite(generatedAt.getTime())) return "Checked now";
  return `Checked ${new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
  }).format(generatedAt)}`;
}

function AttentionCard({ item }: { item: OwnerAttentionItem }) {
  const style = PRIORITY_STYLE[item.priority];
  return (
    <article className={`rounded-2xl border p-4 sm:p-5 ${style.card}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${style.badge}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
          {style.label}
        </span>
        <span className="text-[10px] uppercase tracking-[0.16em] text-muted/70">
          {DOMAIN_LABELS[item.domain]}
        </span>
        {item.affectedCount > 1 ? (
          <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] tabular-nums text-muted">
            {item.affectedCount}
          </span>
        ) : null}
      </div>
      <h3 className="mt-3 font-serif text-xl font-light text-foreground">
        {item.title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{item.detail}</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.14em] text-muted/55">
          {item.sourceLabel}
        </p>
        <Link
          href={item.href}
          className="inline-flex min-h-10 items-center rounded-full border border-border/70 bg-foreground/[0.04] px-4 text-xs font-medium text-foreground transition-colors hover:border-accent/50 hover:bg-accent/10"
        >
          {item.actionLabel}
        </Link>
      </div>
    </article>
  );
}

export function OwnerAttentionQueue() {
  const [data, setData] = useState<OwnerAttentionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const load = useCallback(async (silent = false) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await fetch("/api/admin/attention", {
        headers: getAdminRequestHeaders(),
        cache: "no-store",
        signal: controller.signal,
      });
      const body = (await response.json().catch(() => null)) as
        | OwnerAttentionResponse
        | { error?: string }
        | null;
      if (!response.ok || !body || !("items" in body)) {
        throw new Error(
          body && "error" in body && body.error
            ? body.error
            : "Could not load owner attention.",
        );
      }
      setData(body);
      setError(null);
    } catch (loadError) {
      if (controller.signal.aborted) return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load owner attention.",
      );
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    const refresh = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    const interval = window.setInterval(refresh, 120_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      const activeRequest = requestRef.current;
      requestRef.current = null;
      activeRequest?.abort();
    };
  }, [load]);

  const visibleItems = useMemo(
    () => (expanded ? data?.items ?? [] : (data?.items ?? []).slice(0, 8)),
    [data, expanded],
  );
  const hiddenCount = Math.max(0, (data?.items.length ?? 0) - visibleItems.length);
  const verifiedSources =
    data?.sources.filter((source) => source.state === "ready").length ?? 0;

  return (
    <section
      className="border-t border-border/15 pt-14"
      aria-labelledby="owner-attention-heading"
    >
      <GlassCard tone="default" rim padding="lg" motion="none">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className={craftEyebrow}>Owner attention</p>
            <h2
              id="owner-attention-heading"
              className={`${craftHeading} mt-3 text-2xl sm:text-[1.75rem]`}
            >
              What needs you now
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
              Ranked from real operational records. Unknown sources stay visible
              as exceptions instead of pretending everything is healthy.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={loading || refreshing}
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full border border-border/70 px-4 text-xs text-foreground transition-colors hover:border-accent/50 disabled:cursor-wait disabled:opacity-50"
          >
            {refreshing ? "Checking…" : "Refresh"}
          </button>
        </div>

        {data ? (
          <div className="mt-7 flex flex-wrap gap-2">
            {data.summary.criticalCount > 0 ? (
              <span className="rounded-full border border-red-400/30 bg-red-400/[0.08] px-3 py-1.5 text-xs tabular-nums text-red-100">
                {data.summary.criticalCount} critical
              </span>
            ) : null}
            {data.summary.highCount > 0 ? (
              <span className="rounded-full border border-amber-300/25 bg-amber-300/[0.07] px-3 py-1.5 text-xs tabular-nums text-amber-100">
                {data.summary.highCount} next
              </span>
            ) : null}
            {data.summary.normalCount > 0 ? (
              <span className="rounded-full border border-sky-300/20 bg-sky-300/[0.06] px-3 py-1.5 text-xs tabular-nums text-sky-100">
                {data.summary.normalCount} build
              </span>
            ) : null}
            <span className="rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted">
              {verifiedSources}/{data.sources.length} sources verified
            </span>
            <span className="px-1 py-1.5 text-xs text-muted/60">
              {generatedLabel(data.generatedAt)}
            </span>
          </div>
        ) : null}

        {loading && !data ? (
          <div className="mt-8 grid gap-3" aria-live="polite">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-2xl border border-border/40 bg-foreground/[0.025]"
              />
            ))}
          </div>
        ) : null}

        {error ? (
          <div className="mt-8 rounded-2xl border border-red-400/25 bg-red-400/[0.06] p-5 text-sm leading-relaxed text-red-100">
            {error} The rest of HQ remains available; refresh this queue after
            checking Production Health.
          </div>
        ) : null}

        {!loading && data && data.items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.055] p-6">
            <p className="font-serif text-xl font-light text-emerald-50">
              Normal operations
            </p>
            <p className="mt-2 text-sm leading-relaxed text-emerald-50/70">
              All {data.sources.length} operational sources answered and no
              current exception needs owner intervention.
            </p>
          </div>
        ) : null}

        {visibleItems.length > 0 ? (
          <div className="mt-8 grid gap-3">
            {visibleItems.map((item) => (
              <AttentionCard key={item.id} item={item} />
            ))}
          </div>
        ) : null}

        {data && (hiddenCount > 0 || expanded) ? (
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="mt-6 text-sm text-muted underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
          >
            {expanded ? "Show top priorities" : `Show ${hiddenCount} more`}
          </button>
        ) : null}
      </GlassCard>
    </section>
  );
}
