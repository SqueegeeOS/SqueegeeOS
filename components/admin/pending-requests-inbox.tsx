"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import type { LeadIntakeRecord } from "@/lib/acquisition/lead-record";
import { ROUTES } from "@/lib/navigation/config";

function formatSubmittedAt(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatStatus(status: LeadIntakeRecord["status"]): string {
  if (status === "new") return "New";
  if (status === "contacted") return "Contacted";
  return "Scheduled";
}

export function PendingRequestsInbox() {
  const [leads, setLeads] = useState<LeadIntakeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      const data = (await response.json()) as { leads: LeadIntakeRecord[] };
      setLeads(data.leads);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load requests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  const newCount = leads.filter((lead) => lead.status === "new").length;

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-5xl">
        <Link
          href={ROUTES.hq}
          className="text-[10px] uppercase tracking-widest text-muted transition hover:text-foreground"
        >
          ← Headquarters
        </Link>

        <header className="mt-6 mb-8">
          <p className="text-[10px] uppercase tracking-[0.2em] text-accent">
            Founder inbox
          </p>
          <h1 className="mt-2 font-serif text-3xl font-light">Pending Requests</h1>
          <p className="mt-2 text-sm text-muted">
            Home care requests from the public form — not a pipeline, just what
            came in.
          </p>
          {!loading && newCount > 0 ? (
            <p className="mt-3 text-sm text-foreground/90">
              {newCount} new request{newCount === 1 ? "" : "s"} awaiting follow-up.
            </p>
          ) : null}
        </header>

        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : leads.length === 0 ? (
          <div className="rounded-2xl border border-border/30 bg-surface/40 px-6 py-10 text-center">
            <p className="font-serif text-xl font-light text-foreground/90">
              No requests yet.
            </p>
            <p className="mt-2 text-sm text-muted">
              Submissions from{" "}
              <Link href={ROUTES.request} className="text-accent underline-offset-2 hover:underline">
                /request
              </Link>{" "}
              will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border/30">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-surface/30 text-[10px] uppercase tracking-[0.22em] text-muted">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Address</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Services</th>
                  <th className="px-4 py-3 font-medium">Submitted</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-border/30 last:border-0 hover:bg-surface/20"
                  >
                    <td className="px-4 py-4 align-top">
                      <Link
                        href={`${ROUTES.hqPendingRequests}/${lead.id}`}
                        className="font-medium text-foreground underline-offset-2 hover:text-accent hover:underline"
                      >
                        {lead.name}
                      </Link>
                    </td>
                    <td className="max-w-[12rem] px-4 py-4 align-top text-muted">
                      {lead.serviceAddress}
                    </td>
                    <td className="px-4 py-4 align-top text-muted">
                      <a
                        href={`tel:${lead.phone.replace(/\D/g, "")}`}
                        className="hover:text-foreground"
                      >
                        {lead.phone}
                      </a>
                    </td>
                    <td className="px-4 py-4 align-top text-muted">
                      <a
                        href={`mailto:${lead.email}`}
                        className="hover:text-foreground"
                      >
                        {lead.email}
                      </a>
                    </td>
                    <td className="max-w-[10rem] px-4 py-4 align-top text-muted">
                      {lead.servicesInterested.join(", ") || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 align-top text-muted">
                      {formatSubmittedAt(lead.submittedAt)}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span
                        className={
                          lead.status === "new"
                            ? "text-accent"
                            : "text-muted"
                        }
                      >
                        {formatStatus(lead.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
