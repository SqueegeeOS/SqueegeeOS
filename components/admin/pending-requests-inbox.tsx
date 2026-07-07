"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { HqFounderNav } from "@/components/admin/hq-founder-nav";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { GlassCard } from "@/components/craft/glass-card";
import { MotionReveal } from "@/components/craft/motion-reveal";
import { ShimmerBlock } from "@/components/motion/shimmer-block";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { markRequestsInboxOpened } from "@/lib/admin/requests-inbox-read-state";
import { schedulePresentationFromLead } from "@/lib/acquisition/leads/inbox-client";
import {
  filterLeads,
  formatLeadIntakeStatus,
  formatLeadSubmittedRelative,
  type LeadIntakeFilter,
} from "@/lib/acquisition/leads/inbox";
import type { LeadIntakeRecord } from "@/lib/acquisition/lead-record";
import { craftEyebrow, craftHeading, craftInput } from "@/lib/craft/tokens";
import { customerWorkspaceHref } from "@/lib/hq/customer-workspace/routes";
import { riseSubtle } from "@/lib/motion/system";
import { ROUTES } from "@/lib/navigation/config";

const FILTERS: Array<{ id: LeadIntakeFilter; label: string }> = [
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "scheduled", label: "Scheduled" },
  { id: "archived", label: "Archived" },
  { id: "all", label: "All" },
];

const LOADING_ROW_COUNT = 5;

function RequestsInboxLoadingShell() {
  return (
    <GlassCard tone="subtle" padding="none" motion="none" className="overflow-hidden">
      {Array.from({ length: LOADING_ROW_COUNT }, (_, index) => (
        <div
          key={index}
          className="border-b border-border/20 px-5 py-4 last:border-0 sm:px-6"
        >
          <div className="flex items-start justify-between gap-4">
            <ShimmerBlock className="h-5 w-40 max-w-[55%] rounded-full" />
            <ShimmerBlock className="h-4 w-16 shrink-0 rounded-full" />
          </div>
          <ShimmerBlock className="mt-2 h-4 w-full max-w-md rounded-full" />
        </div>
      ))}
      <p className="sr-only">Loading requests…</p>
    </GlassCard>
  );
}

function RequestInboxRow({
  lead,
  index,
  busy,
  onOpen,
  onSchedule,
}: {
  lead: LeadIntakeRecord;
  index: number;
  busy: boolean;
  onOpen: () => void;
  onSchedule: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const delay = reduceMotion ? 0 : Math.min(index, 8) * 0.06;
  const services =
    lead.servicesInterested.length > 0
      ? lead.servicesInterested.join(", ")
      : null;
  const detailLine = services
    ? `${lead.serviceAddress} · ${services}`
    : lead.serviceAddress;

  return (
    <motion.div
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      variants={riseSubtle}
      transition={{ delay }}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className="group flex cursor-pointer items-start gap-4 border-b border-border/20 px-5 py-4 transition-colors last:border-0 hover:bg-surface/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/30 sm:px-6"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate font-medium text-foreground">{lead.name}</p>
          <time
            dateTime={lead.submittedAt}
            className="shrink-0 text-xs tabular-nums text-muted"
          >
            {formatLeadSubmittedRelative(lead.submittedAt)}
          </time>
        </div>
        <p className="mt-1 truncate text-sm leading-relaxed text-muted">
          {detailLine}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2 pt-0.5">
        <span
          className={
            lead.status === "new"
              ? "text-xs uppercase tracking-[0.14em] text-accent"
              : "text-xs uppercase tracking-[0.14em] text-muted"
          }
        >
          {formatLeadIntakeStatus(lead.status)}
        </span>
        {lead.status === "new" ? (
          <button
            type="button"
            disabled={busy}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onSchedule();
            }}
            className="rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-muted shadow-[var(--shadow-ambient)] backdrop-blur-sm transition-[border-color,color,opacity] duration-300 hover:border-accent/25 hover:text-foreground disabled:opacity-40 max-sm:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
          >
            Schedule presentation
          </button>
        ) : null}
      </div>
    </motion.div>
  );
}

export function PendingRequestsInbox() {
  const router = useRouter();
  const [leads, setLeads] = useState<LeadIntakeRecord[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<LeadIntakeFilter>("new");
  const [searchQuery, setSearchQuery] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/lead-intakes", {
        headers: getAdminRequestHeaders(),
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to load requests");
      }
      const data = (await response.json()) as {
        leads: LeadIntakeRecord[];
        newCount: number;
      };
      setLeads(data.leads);
      setNewCount(data.newCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load requests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    markRequestsInboxOpened();
  }, []);

  const filteredLeads = useMemo(
    () => filterLeads(leads, statusFilter, searchQuery),
    [leads, searchQuery, statusFilter],
  );

  const runSchedule = useCallback(
    async (lead: LeadIntakeRecord) => {
      setActingId(lead.id);
      try {
        const href = await schedulePresentationFromLead(lead);
        router.push(href);
        await loadLeads();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      } finally {
        setActingId(null);
      }
    },
    [loadLeads, router],
  );

  return (
    <AmbientStage className="px-4 py-10 text-foreground sm:px-6 sm:py-12">
      <div className="relative mx-auto max-w-6xl">
        <HqFounderNav newCount={newCount} />

        <MotionReveal className="mt-10 mb-10">
          <p className={craftEyebrow}>Founder inbox</p>
          <h1 className={`${craftHeading} mt-3 text-3xl sm:text-4xl`}>Requests</h1>
          <p className="mt-4 max-w-2xl text-sm leading-[1.65] text-muted">
            Every home care request from the public form — follow up, schedule a
            presentation, or archive when handled.
          </p>
        </MotionReveal>

        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setStatusFilter(filter.id)}
                className={
                  statusFilter === filter.id
                    ? "rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-xs uppercase tracking-[0.16em] text-foreground"
                    : "rounded-full border border-border/40 px-4 py-2 text-xs uppercase tracking-[0.16em] text-muted transition hover:border-border hover:text-foreground"
                }
              >
                {filter.label}
              </button>
            ))}
          </div>
          <label className="block w-full lg:max-w-sm">
            <span className="sr-only">Search requests</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search name, phone, email, address…"
              className={craftInput + " !rounded-full"}
            />
          </label>
        </div>

        {loading ? (
          <RequestsInboxLoadingShell />
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : filteredLeads.length === 0 ? (
          <GlassCard tone="subtle" motion="rise" className="px-6 py-14 text-center">
            <p className="font-serif text-2xl font-light text-foreground/90">
              {leads.length === 0
                ? "No requests yet."
                : "No requests match this view."}
            </p>
            <p className="mt-3 text-sm text-muted">
              {leads.length === 0 ? (
                <>
                  When someone submits{" "}
                  <Link
                    href={ROUTES.request}
                    className="text-accent underline-offset-2 hover:underline"
                  >
                    /request
                  </Link>
                  , it appears here immediately.
                </>
              ) : (
                "Try another filter or clear your search."
              )}
            </p>
          </GlassCard>
        ) : (
          <GlassCard tone="subtle" padding="none" motion="none" className="overflow-hidden">
            {filteredLeads.map((lead, index) => (
              <RequestInboxRow
                key={lead.id}
                lead={lead}
                index={index}
                busy={actingId === lead.id}
                onOpen={() => router.push(customerWorkspaceHref("lead", lead.id))}
                onSchedule={() => void runSchedule(lead)}
              />
            ))}
          </GlassCard>
        )}
      </div>
    </AmbientStage>
  );
}
