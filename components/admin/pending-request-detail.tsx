"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import type { LeadIntakeRecord } from "@/lib/acquisition/lead-record";
import { ROUTES } from "@/lib/navigation/config";
import { formatTierPrice } from "@/lib/membership/tier-config";

function formatSubmittedAt(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-border/25 py-4 last:border-0">
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted">{label}</p>
      <div className="mt-2 text-sm leading-relaxed text-foreground">{children}</div>
    </div>
  );
}

export function PendingRequestDetail({ id }: { id: string }) {
  const [lead, setLead] = useState<LeadIntakeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLead = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/lead-intakes/${id}`, {
        headers: getAdminRequestHeaders(),
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(response.status === 404 ? "Request not found" : "Failed to load");
      }
      const data = (await response.json()) as { lead: LeadIntakeRecord };
      setLead(data.lead);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load request");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadLead();
  }, [loadLead]);

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-2xl">
        <Link
          href={ROUTES.hqPendingRequests}
          className="text-[10px] uppercase tracking-widest text-muted transition hover:text-foreground"
        >
          ← Pending Requests
        </Link>

        {loading ? (
          <p className="mt-8 text-sm text-muted">Loading…</p>
        ) : error ? (
          <p className="mt-8 text-sm text-red-500">{error}</p>
        ) : lead ? (
          <>
            <header className="mt-6 mb-8">
              <p className="text-[10px] uppercase tracking-[0.2em] text-accent">
                Request submission
              </p>
              <h1 className="mt-2 font-serif text-3xl font-light">{lead.name}</h1>
              <p className="mt-2 text-sm text-muted">
                {formatSubmittedAt(lead.submittedAt)} ·{" "}
                <span className="capitalize">{lead.status}</span>
              </p>
            </header>

            <div className="rounded-2xl border border-border/30 bg-surface/20 px-6">
              <DetailRow label="Address">{lead.serviceAddress}</DetailRow>
              <DetailRow label="Phone">
                <a
                  href={`tel:${lead.phone.replace(/\D/g, "")}`}
                  className="text-accent underline-offset-2 hover:underline"
                >
                  {lead.phone}
                </a>
              </DetailRow>
              <DetailRow label="Email">
                <a
                  href={`mailto:${lead.email}`}
                  className="text-accent underline-offset-2 hover:underline"
                >
                  {lead.email}
                </a>
              </DetailRow>
              <DetailRow label="Preferred contact">{lead.preferredContactMethod}</DetailRow>
              <DetailRow label="Services requested">
                {lead.servicesInterested.length > 0
                  ? lead.servicesInterested.join(", ")
                  : "—"}
              </DetailRow>
              {lead.membershipTier ? (
                <DetailRow label="Membership tier">
                  {lead.membershipTier === "quarterly" ? "Quarterly" : "Bi-Annual"}
                </DetailRow>
              ) : null}
              {lead.squareFootage ? (
                <DetailRow label="Square footage">
                  {lead.squareFootage.toLocaleString("en-US")} sq ft
                </DetailRow>
              ) : null}
              {lead.estimatedVisitPrice ? (
                <DetailRow label="Estimated visit price">
                  {formatTierPrice(lead.estimatedVisitPrice)}
                </DetailRow>
              ) : null}
              {lead.preferredStartWindow ? (
                <DetailRow label="Preferred start">
                  {lead.preferredStartWindow}
                </DetailRow>
              ) : null}
              <DetailRow label="Notes">
                {lead.notes.trim() ? (
                  <p className="whitespace-pre-wrap">{lead.notes}</p>
                ) : (
                  "—"
                )}
              </DetailRow>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
