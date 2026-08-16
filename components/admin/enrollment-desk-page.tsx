"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { HqFounderNav } from "@/components/admin/hq-founder-nav";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { GlassCard } from "@/components/craft/glass-card";
import { MotionReveal } from "@/components/craft/motion-reveal";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { useAdminUnlockedState } from "@/lib/admin/use-admin-unlocked-state";
import { craftEyebrow, craftHeading } from "@/lib/craft/tokens";

interface EnrollmentDeskData {
  readiness: {
    readyToSend: boolean;
    checks: Array<{
      id: string;
      label: string;
      ready: boolean;
      detail: string;
      missing: string[];
    }>;
  };
  documentVersions: Array<{
    id: string;
    document_kind: string;
    version: string;
    status: string;
    approved_at: string | null;
    approved_by: string | null;
    review_notes: string | null;
    updated_at: string;
  }>;
  packets: Array<{
    id: string;
    presentation_id: string;
    customer_name: string;
    customer_email: string;
    status: string;
    docusign_status: string | null;
    signature_sent_at: string | null;
    signed_at: string | null;
    payment_link_sent_at: string | null;
    payment_completed_at: string | null;
    portal_ready_at: string | null;
    last_error_code: string | null;
    last_error_message: string | null;
    updated_at: string;
  }>;
  loadedAt: string;
}

function prettyStatus(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function EnrollmentDeskContent() {
  const [data, setData] = useState<EnrollmentDeskData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/enrollment/readiness", {
        headers: getAdminRequestHeaders(),
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as
        | (EnrollmentDeskData & { error?: string })
        | null;
      if (!response.ok || !body) {
        throw new Error(body?.error ?? "Enrollment Desk could not load.");
      }
      setData(body);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Enrollment Desk could not load.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <AmbientStage className="px-4 py-10 text-foreground sm:px-6 sm:py-12">
      <div className="relative mx-auto max-w-7xl">
        <HqFounderNav />
        <MotionReveal className="mb-10 mt-10">
          <p className={craftEyebrow}>Trust handoff</p>
          <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className={`${craftHeading} text-3xl sm:text-4xl`}>
                Enrollment Desk
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-[1.7] text-muted">
                One packet, three trusted surfaces: DocuSign for the agreement,
                Stripe for the card, and HomeAtlas for the life of the home.
                Nothing sends until every legal and provider gate is genuinely
                ready.
              </p>
            </div>
            <Link
              href="/presentations"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-accent/25 bg-accent/[0.08] px-5 text-xs font-semibold text-accent hover:bg-accent/[0.13]"
            >
              Open presentations
            </Link>
          </div>
        </MotionReveal>

        {loading ? (
          <p className="text-sm text-muted">Checking the handoff…</p>
        ) : error ? (
          <GlassCard
            tone="subtle"
            padding="lg"
            motion="rise"
            className="border-red-400/25"
          >
            <p className="text-sm text-red-200">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 rounded-full border border-white/15 px-4 py-2 text-xs"
            >
              Try again
            </button>
          </GlassCard>
        ) : data ? (
          <div className="space-y-8">
            <GlassCard tone="subtle" padding="lg" motion="rise">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className={craftEyebrow}>Launch gate</p>
                  <h2 className="mt-2 font-serif text-2xl font-light">
                    {data.readiness.readyToSend
                      ? "Ready for a controlled test"
                      : "Safely paused"}
                  </h2>
                </div>
                <span
                  className={`w-fit rounded-full border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                    data.readiness.readyToSend
                      ? "border-emerald-300/30 bg-emerald-300/[0.08] text-emerald-200"
                      : "border-amber-300/25 bg-amber-300/[0.07] text-amber-100"
                  }`}
                >
                  {data.readiness.readyToSend
                    ? "All gates green"
                    : "No live sends"}
                </span>
              </div>
              <div className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {data.readiness.checks.map((check) => (
                  <div
                    key={check.id}
                    className={`rounded-2xl border p-4 ${
                      check.ready
                        ? "border-emerald-300/15 bg-emerald-300/[0.035]"
                        : "border-white/[0.08] bg-black/10"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <strong className="text-sm font-medium">
                        {check.label}
                      </strong>
                      <span
                        className={
                          check.ready ? "text-emerald-300" : "text-amber-200"
                        }
                      >
                        {check.ready ? "✓" : "○"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted">
                      {check.detail}
                    </p>
                  </div>
                ))}
              </div>
              {!data.readiness.readyToSend ? (
                <p className="mt-6 rounded-xl border border-accent/15 bg-accent/[0.05] px-4 py-3 text-xs leading-relaxed text-muted">
                  The app side is built to fail closed. The attorney-review brief
                  lives in <code className="text-accent">docs/legal/CALIFORNIA_ENROLLMENT_PACKET_ATTORNEY_REVIEW.md</code>;
                  after counsel approves the exact two-document DocuSign
                  template, record both approved hashes and add the listed
                  Vercel variables.
                </p>
              ) : null}
            </GlassCard>

            <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
              <GlassCard tone="subtle" padding="lg" motion="rise">
                <p className={craftEyebrow}>Legal versions</p>
                <h2 className="mt-2 font-serif text-2xl font-light">
                  Two documents, one envelope
                </h2>
                <div className="mt-6 space-y-3">
                  {data.documentVersions.map((version) => (
                    <div
                      key={version.id}
                      className="rounded-2xl border border-white/[0.08] bg-black/10 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">
                            {version.document_kind ===
                            "master_service_agreement"
                              ? "California LLC MSA"
                              : "Property Service & Quote"}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            {version.version}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[9px] uppercase tracking-[0.12em] ${
                            version.status === "approved"
                              ? "bg-emerald-300/10 text-emerald-200"
                              : "bg-amber-300/10 text-amber-100"
                          }`}
                        >
                          {prettyStatus(version.status)}
                        </span>
                      </div>
                      {version.review_notes ? (
                        <p className="mt-3 text-xs leading-relaxed text-muted">
                          {version.review_notes}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </GlassCard>

              <GlassCard tone="subtle" padding="lg" motion="rise">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className={craftEyebrow}>Live packet trail</p>
                    <h2 className="mt-2 font-serif text-2xl font-light">
                      Customer handoffs
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => void load()}
                    className="rounded-full border border-white/10 px-4 py-2 text-xs text-muted hover:text-foreground"
                  >
                    Refresh
                  </button>
                </div>
                {data.packets.length === 0 ? (
                  <div className="mt-6 rounded-2xl border border-dashed border-white/10 px-5 py-10 text-center">
                    <p className="font-serif text-xl font-light">
                      No packet has left the nest.
                    </p>
                    <p className="mt-2 text-xs text-muted">
                      That is correct while the legal/provider gate is paused.
                    </p>
                  </div>
                ) : (
                  <div className="mt-6 space-y-3">
                    {data.packets.map((packet) => (
                      <Link
                        key={packet.id}
                        href={`/presentations/${packet.presentation_id}/edit`}
                        className="block rounded-2xl border border-white/[0.08] bg-black/10 p-4 transition hover:border-accent/20"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-medium">
                              {packet.customer_name}
                            </p>
                            <p className="mt-1 text-xs text-muted">
                              {packet.customer_email}
                            </p>
                          </div>
                          <span
                            className={`w-fit rounded-full px-3 py-1 text-[9px] uppercase tracking-[0.12em] ${
                              packet.status === "portal_ready"
                                ? "bg-emerald-300/10 text-emerald-200"
                                : packet.status === "needs_attention"
                                  ? "bg-red-300/10 text-red-200"
                                  : "bg-accent/10 text-accent"
                            }`}
                          >
                            {prettyStatus(packet.status)}
                          </span>
                        </div>
                        {packet.last_error_message ? (
                          <p className="mt-3 text-xs leading-relaxed text-red-200/80">
                            {packet.last_error_message}
                          </p>
                        ) : null}
                      </Link>
                    ))}
                  </div>
                )}
              </GlassCard>
            </div>
          </div>
        ) : null}
      </div>
    </AmbientStage>
  );
}

export function EnrollmentDeskPage() {
  const [unlocked, setUnlocked] = useAdminUnlockedState();
  if (!unlocked) return <AdminPinGate onUnlock={() => setUnlocked(true)} />;
  return <EnrollmentDeskContent />;
}
