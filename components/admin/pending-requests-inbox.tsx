"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CustomerWorkspaceLink } from "@/components/admin/customer-workspace-link";
import { HqFounderNav } from "@/components/admin/hq-founder-nav";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { GlassCard } from "@/components/craft/glass-card";
import { MotionReveal } from "@/components/craft/motion-reveal";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { markRequestsInboxOpened } from "@/lib/admin/requests-inbox-read-state";
import {
  schedulePresentationFromLead,
  updateLeadIntakeStatusClient,
} from "@/lib/acquisition/leads/inbox-client";
import {
  filterLeads,
  formatLeadIntakeStatus,
  formatLeadSubmittedAt,
  type LeadIntakeFilter,
} from "@/lib/acquisition/leads/inbox";
import type { LeadIntakeRecord } from "@/lib/acquisition/lead-record";
import { craftEyebrow, craftHeading, craftInput } from "@/lib/craft/tokens";
import { ROUTES } from "@/lib/navigation/config";
import { customerWorkspaceHref } from "@/lib/hq/customer-workspace/routes";

const FILTERS: Array<{ id: LeadIntakeFilter; label: string }> = [
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "scheduled", label: "Scheduled" },
  { id: "archived", label: "Archived" },
  { id: "all", label: "All" },
];

function ActionButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      className="rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-muted shadow-[var(--shadow-ambient)] backdrop-blur-sm transition-[border-color,color] duration-300 hover:border-accent/25 hover:text-foreground disabled:opacity-40"
    >
      {children}
    </button>
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

  const runAction = useCallback(
    async (leadId: string, action: () => Promise<void>) => {
      setActingId(leadId);
      try {
        await action();
        await loadLeads();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      } finally {
        setActingId(null);
      }
    },
    [loadLeads],
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
          <p className="text-sm text-muted">Loading…</p>
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
          <GlassCard tone="subtle" motion="rise" padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-surface/30 text-[10px] uppercase tracking-[0.22em] text-muted">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Address</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Services Requested</th>
                  <th className="px-4 py-3 font-medium">Submitted At</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => {
                  const busy = actingId === lead.id;
                  return (
                    <tr
                      key={lead.id}
                      onClick={() =>
                        router.push(customerWorkspaceHref("lead", lead.id))
                      }
                      className="cursor-pointer border-b border-border/30 last:border-0 hover:bg-surface/20"
                    >
                      <td className="px-4 py-4 align-top font-medium text-foreground">
                        <CustomerWorkspaceLink
                          type="lead"
                          id={lead.id}
                          onClick={(event) => event.stopPropagation()}
                        >
                          {lead.name}
                        </CustomerWorkspaceLink>
                      </td>
                      <td className="max-w-[12rem] px-4 py-4 align-top text-muted">
                        {lead.serviceAddress}
                      </td>
                      <td className="px-4 py-4 align-top text-muted">
                        {lead.phone}
                      </td>
                      <td className="px-4 py-4 align-top text-muted">
                        {lead.email}
                      </td>
                      <td className="max-w-[10rem] px-4 py-4 align-top text-muted">
                        {lead.servicesInterested.join(", ") || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 align-top text-muted">
                        {formatLeadSubmittedAt(lead.submittedAt)}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span
                          className={
                            lead.status === "new" ? "text-accent" : "text-muted"
                          }
                        >
                          {formatLeadIntakeStatus(lead.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-wrap gap-2">
                          {lead.status === "new" ? (
                            <ActionButton
                              disabled={busy}
                              onClick={() =>
                                void runAction(lead.id, () =>
                                  updateLeadIntakeStatusClient(
                                    lead.id,
                                    "contacted",
                                  ).then(() => undefined),
                                )
                              }
                            >
                              Mark Contacted
                            </ActionButton>
                          ) : null}
                          {lead.status !== "scheduled" &&
                          lead.status !== "archived" ? (
                            <ActionButton
                              disabled={busy}
                              onClick={() =>
                                void runAction(lead.id, async () => {
                                  const href =
                                    await schedulePresentationFromLead(lead);
                                  router.push(href);
                                })
                              }
                            >
                              Schedule Presentation
                            </ActionButton>
                          ) : null}
                          {lead.status !== "archived" ? (
                            <ActionButton
                              disabled={busy}
                              onClick={() =>
                                void runAction(lead.id, () =>
                                  updateLeadIntakeStatusClient(
                                    lead.id,
                                    "archived",
                                  ).then(() => undefined),
                                )
                              }
                            >
                              Archive
                            </ActionButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </GlassCard>
        )}
      </div>
    </AmbientStage>
  );
}
