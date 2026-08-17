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
import type {
  EnrollmentLegalReviewDocumentId,
  EnrollmentLegalReviewPacket,
} from "@/lib/enrollment/legal-review-packet";

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
  providerLaunchPlan: {
    connectCallbackUrl: string;
    customerRoleName: string;
    requiredTabLabels: string[];
    requiredEnvelopeEvents: string[];
    canRunDocuSignProbe: boolean;
    probeSafetyNote: string;
    steps: Array<{
      id: string;
      label: string;
      status: "complete" | "action_needed" | "waiting";
      detail: string;
      missing: string[];
    }>;
    links: {
      docusignAppsAndKeys: string;
      docusignConnect: string;
      vercelEnvironmentVariables: string;
    };
  };
  documentVersions: Array<{
    id: string;
    document_kind: string;
    version: string;
    status: string;
    review_copy_sha256: string | null;
    content_sha256: string | null;
    approved_at: string | null;
    approved_by: string | null;
    release_authority: "owner" | "counsel" | "legacy" | null;
    counsel_review_status: "pending" | "reviewed" | "revisions_requested";
    counsel_reviewed_at: string | null;
    counsel_reviewed_by: string | null;
    review_notes: string | null;
    updated_at: string;
  }>;
  packets: Array<{
    id: string;
    presentation_id: string;
    customer_name: string;
    customer_email: string;
    status: string;
    payment_rail: "stripe_card" | "manual_cash_check";
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
  legalReviewPacket: EnrollmentLegalReviewPacket;
  loadedAt: string;
}

interface DocuSignProbeResult {
  ok: boolean;
  authorization: boolean;
  templateFound: boolean;
  customerRoleFound: boolean;
  templateName: string | null;
  documentCount: number;
  documents: Array<{
    documentId: string;
    name: string;
    sha256: string;
    documentKind:
      | "master_service_agreement"
      | "service_quote_agreement"
      | null;
  }>;
  signatureTabCount: number;
  missingTabLabels: string[];
  connectHmacConfigured: boolean;
  errorCode: string | null;
  message: string;
}

function prettyStatus(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function EnrollmentDeskContent() {
  const [data, setData] = useState<EnrollmentDeskData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLegalDocument, setSelectedLegalDocument] =
    useState<EnrollmentLegalReviewDocumentId>("master_service_agreement");
  const [docusignProbe, setDocusignProbe] =
    useState<DocuSignProbeResult | null>(null);
  const [probingDocusign, setProbingDocusign] = useState(false);
  const [releasingDocuments, setReleasingDocuments] = useState(false);
  const [releaseMessage, setReleaseMessage] = useState<string | null>(null);
  const [copiedCallback, setCopiedCallback] = useState(false);

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

  const runDocusignProbe = useCallback(async () => {
    setProbingDocusign(true);
    setDocusignProbe(null);
    setReleaseMessage(null);
    try {
      const response = await fetch("/api/admin/enrollment/docusign/probe", {
        method: "POST",
        headers: getAdminRequestHeaders(),
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as
        | (DocuSignProbeResult & { error?: string })
        | null;
      if (!response.ok || !body) {
        throw new Error(body?.error ?? "The DocuSign check could not run.");
      }
      setDocusignProbe(body);
    } catch (probeError) {
      setDocusignProbe({
        ok: false,
        authorization: false,
        templateFound: false,
        customerRoleFound: false,
        templateName: null,
        documentCount: 0,
        documents: [],
        signatureTabCount: 0,
        missingTabLabels: [],
        connectHmacConfigured: false,
        errorCode: "request_failed",
        message:
          probeError instanceof Error
            ? probeError.message
            : "The DocuSign check could not run.",
      });
    } finally {
      setProbingDocusign(false);
    }
  }, []);

  const releaseDocusignDocuments = useCallback(async () => {
    setReleasingDocuments(true);
    setReleaseMessage(null);
    try {
      const msaFile = docusignProbe?.documents.find(
        (document) => document.documentKind === "master_service_agreement",
      );
      const serviceFile = docusignProbe?.documents.find(
        (document) => document.documentKind === "service_quote_agreement",
      );
      if (!docusignProbe?.ok || !msaFile || !serviceFile) {
        throw new Error("Run and review a passing DocuSign check first.");
      }
      const response = await fetch("/api/admin/enrollment/legal-release", {
        method: "POST",
        headers: {
          ...getAdminRequestHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          msaSha256: msaFile.sha256,
          serviceSha256: serviceFile.sha256,
        }),
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null;
      if (!response.ok || !body) {
        throw new Error(body?.error ?? "The exact files could not be released.");
      }
      setReleaseMessage(body.message ?? "The exact files are owner-released.");
      await load();
    } catch (releaseError) {
      setReleaseMessage(
        releaseError instanceof Error
          ? releaseError.message
          : "The exact files could not be released.",
      );
    } finally {
      setReleasingDocuments(false);
    }
  }, [docusignProbe, load]);

  const activeLegalDocument = data?.legalReviewPacket.documents.find(
    (document) => document.id === selectedLegalDocument,
  );

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
                Nothing sends until the owner-released document, rollout, and
                provider gates are genuinely ready.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href="/hq/enrollment/review"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 text-xs font-semibold text-on-accent hover:brightness-105"
              >
                Open agreement packet
              </Link>
              <Link
                href="/presentations"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-accent/25 bg-accent/[0.08] px-5 text-xs font-semibold text-accent hover:bg-accent/[0.13]"
              >
                Open presentations
              </Link>
            </div>
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
                  The app side is built to fail closed. Use the review room below
                  to inspect the working packet now. The owner may release the
                  exact customer-facing versions for operation; outside counsel
                  can review a later revision without changing what prior
                  customers signed.
                </p>
              ) : null}
            </GlassCard>

            <GlassCard tone="subtle" padding="lg" motion="rise">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className={craftEyebrow}>Activation map</p>
                  <h2 className="mt-2 font-serif text-2xl font-light sm:text-3xl">
                    Turn the handoff on without guesswork
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
                    HomeAtlas now separates every owner action from every
                    provider dependency and rollout control. Secrets stay server-only; this page
                    exposes only safe URLs, required labels, and missing setting
                    names.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={data.providerLaunchPlan.links.docusignAppsAndKeys}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 px-4 text-xs text-muted transition hover:border-accent/25 hover:text-foreground"
                  >
                    Apps &amp; Keys
                  </a>
                  <a
                    href={data.providerLaunchPlan.links.docusignConnect}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 px-4 text-xs text-muted transition hover:border-accent/25 hover:text-foreground"
                  >
                    Connect webhooks
                  </a>
                  <a
                    href={data.providerLaunchPlan.links.vercelEnvironmentVariables}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 px-4 text-xs text-muted transition hover:border-accent/25 hover:text-foreground"
                  >
                    Vercel settings
                  </a>
                </div>
              </div>

              <div className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {data.providerLaunchPlan.steps.map((step, index) => (
                  <div
                    key={step.id}
                    className={`rounded-2xl border p-4 ${
                      step.status === "complete"
                        ? "border-emerald-300/15 bg-emerald-300/[0.035]"
                        : step.status === "action_needed"
                          ? "border-accent/20 bg-accent/[0.055]"
                          : "border-white/[0.08] bg-black/10"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted">
                          Step {index + 1}
                        </span>
                        <h3 className="mt-1 text-sm font-medium text-foreground">
                          {step.label}
                        </h3>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.12em] ${
                          step.status === "complete"
                            ? "bg-emerald-300/10 text-emerald-200"
                            : step.status === "action_needed"
                              ? "bg-accent/10 text-accent"
                              : "bg-white/[0.06] text-muted"
                        }`}
                      >
                        {step.status === "complete"
                          ? "Done"
                          : step.status === "action_needed"
                            ? "Action"
                            : "Waiting"}
                      </span>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-muted">
                      {step.detail}
                    </p>
                    {step.missing.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {step.missing.map((missing) => (
                          <code
                            key={missing}
                            className="rounded-md border border-white/[0.07] bg-black/20 px-2 py-1 text-[9px] text-muted"
                          >
                            {missing}
                          </code>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-[0.56fr_0.44fr]">
                <div className="rounded-2xl border border-white/[0.08] bg-black/10 p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                        DocuSign Connect callback
                      </p>
                      <p className="mt-2 break-all font-mono text-xs leading-relaxed text-foreground">
                        {data.providerLaunchPlan.connectCallbackUrl}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(data.providerLaunchPlan.connectCallbackUrl)
                          .then(() => setCopiedCallback(true));
                      }}
                      className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-white/10 px-4 text-xs text-muted hover:text-foreground"
                    >
                      {copiedCallback ? "Copied" : "Copy URL"}
                    </button>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-muted">
                    Send JSON envelope events here with HMAC signing enabled.
                    Customer role: <strong className="text-foreground">{data.providerLaunchPlan.customerRoleName}</strong>.
                  </p>
                  <details className="mt-4 rounded-xl border border-white/[0.07] bg-black/15 px-4 py-3">
                    <summary className="cursor-pointer text-xs font-medium text-foreground">
                      Template contract · {data.providerLaunchPlan.requiredTabLabels.length} locked fields
                    </summary>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {data.providerLaunchPlan.requiredTabLabels.map((label) => (
                        <code
                          key={label}
                          className="rounded-md bg-white/[0.045] px-2 py-1 text-[9px] text-muted"
                        >
                          {label}
                        </code>
                      ))}
                    </div>
                    <p className="mt-3 text-[10px] leading-relaxed text-muted">
                      Events: {data.providerLaunchPlan.requiredEnvelopeEvents.join(", ")}
                    </p>
                  </details>
                </div>

                <div className="rounded-2xl border border-accent/15 bg-accent/[0.045] p-4 sm:p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                    Read-only provider check
                  </p>
                  <h3 className="mt-2 font-serif text-xl font-light">
                    Prove the template before a customer can receive it
                  </h3>
                  <p className="mt-3 text-xs leading-relaxed text-muted">
                    {data.providerLaunchPlan.probeSafetyNote}
                  </p>
                  <button
                    type="button"
                    disabled={
                      probingDocusign ||
                      !data.providerLaunchPlan.canRunDocuSignProbe
                    }
                    onClick={() => void runDocusignProbe()}
                    className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-accent px-5 text-xs font-semibold text-on-accent transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {probingDocusign
                      ? "Checking OAuth + template…"
                      : data.providerLaunchPlan.canRunDocuSignProbe
                        ? "Run read-only DocuSign check"
                        : "Add JWT + template settings first"}
                  </button>
                  {docusignProbe ? (
                    <div
                      className={`mt-4 rounded-xl border px-4 py-3 text-xs leading-relaxed ${
                        docusignProbe.ok
                          ? "border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-100"
                          : "border-amber-300/20 bg-amber-300/[0.055] text-amber-100"
                      }`}
                    >
                      <p className="font-medium">
                        {docusignProbe.ok ? "Template contract passed" : "Still safely blocked"}
                      </p>
                      <p className="mt-1 opacity-80">{docusignProbe.message}</p>
                      {docusignProbe.authorization ? (
                        <p className="mt-2 text-[10px] opacity-75">
                          {docusignProbe.documentCount} documents · {docusignProbe.signatureTabCount} signature tabs · {docusignProbe.missingTabLabels.length} missing locked fields
                        </p>
                      ) : null}
                      {docusignProbe.documents.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {docusignProbe.documents.map((document) => (
                            <div
                              key={document.documentId}
                              className="rounded-lg border border-current/10 bg-black/10 px-3 py-2"
                            >
                              <p className="text-[10px] font-medium">
                                {document.name}
                              </p>
                              <p className="mt-1 break-all font-mono text-[8px] opacity-70">
                                SHA-256 {document.sha256}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {docusignProbe?.ok ? (
                    <button
                      type="button"
                      disabled={releasingDocuments}
                      onClick={() => void releaseDocusignDocuments()}
                      className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-emerald-300/25 bg-emerald-300/[0.07] px-5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/[0.11] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {releasingDocuments
                        ? "Verifying exact files again…"
                        : "Owner-release these exact files"}
                    </button>
                  ) : null}
                  {releaseMessage ? (
                    <p className="mt-3 rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-[10px] leading-relaxed text-muted">
                      {releaseMessage}
                    </p>
                  ) : null}
                </div>
              </div>
            </GlassCard>

            <GlassCard tone="subtle" padding="lg" motion="rise">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className={craftEyebrow}>Agreement review room</p>
                  <h2 className="mt-2 font-serif text-2xl font-light sm:text-3xl">
                    See exactly what the customer accepts
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
                    {data.legalReviewPacket.summary}
                  </p>
                </div>
                <span className="w-fit rounded-full border border-amber-300/25 bg-amber-300/[0.07] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100">
                  Working review packet
                </span>
              </div>

              <div className="mt-7 grid gap-5 lg:grid-cols-[0.34fr_0.66fr]">
                <div className="space-y-2">
                  {data.legalReviewPacket.documents.map((document) => {
                    const selected = document.id === selectedLegalDocument;
                    return (
                      <button
                        key={document.id}
                        type="button"
                        onClick={() => setSelectedLegalDocument(document.id)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          selected
                            ? "border-accent/30 bg-accent/[0.09]"
                            : "border-white/[0.08] bg-black/10 hover:border-white/[0.14]"
                        }`}
                      >
                        <span className="block text-sm font-medium text-foreground">
                          {document.title}
                        </span>
                        <span className="mt-1 block text-[11px] leading-relaxed text-muted">
                          {document.purpose}
                        </span>
                        <span
                          className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[9px] uppercase tracking-[0.12em] ${
                            document.status === "working_draft"
                              ? "bg-accent/10 text-accent"
                              : "bg-amber-300/10 text-amber-100"
                          }`}
                        >
                          {document.status === "working_draft"
                            ? "Owner-release candidate"
                            : "Exact statutory text required"}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {activeLegalDocument ? (
                  <article className="rounded-3xl border border-white/[0.09] bg-black/15 p-5 sm:p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-accent">
                          {activeLegalDocument.version}
                        </p>
                        <h3 className="mt-2 font-serif text-2xl font-light">
                          {activeLegalDocument.title}
                        </h3>
                      </div>
                      <span className="w-fit rounded-full border border-white/10 px-3 py-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                        Internal preview
                      </span>
                    </div>

                    <div className="mt-6 space-y-2">
                      {activeLegalDocument.sections.map((section, index) => (
                        <details
                          key={section.heading}
                          open={index === 0}
                          className="group rounded-2xl border border-white/[0.08] bg-white/[0.02]"
                        >
                          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium marker:content-none">
                            <span className="flex items-center justify-between gap-3">
                              {section.heading}
                              <span className="text-accent transition group-open:rotate-45">
                                +
                              </span>
                            </span>
                          </summary>
                          <div className="space-y-3 border-t border-white/[0.06] px-4 py-4">
                            {section.paragraphs.map((paragraph) => (
                              <p
                                key={paragraph}
                                className="text-xs leading-[1.75] text-muted"
                              >
                                {paragraph}
                              </p>
                            ))}
                          </div>
                        </details>
                      ))}
                    </div>

                    <div className="mt-6 rounded-2xl border border-amber-300/15 bg-amber-300/[0.045] p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-100">
                        Final review focus
                      </p>
                      <ul className="mt-3 space-y-2">
                        {activeLegalDocument.reviewFocus.map((item) => (
                          <li
                            key={item}
                            className="flex gap-2 text-xs leading-relaxed text-muted"
                          >
                            <span className="text-amber-200">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/[0.08] bg-black/10 p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">
                        Review-copy fingerprint
                      </p>
                      <p className="mt-2 break-all font-mono text-[10px] leading-relaxed text-foreground">
                        SHA-256 {activeLegalDocument.integrity.sha256}
                      </p>
                      <p className="mt-2 text-[11px] leading-relaxed text-muted">
                        This proves which internal wording is under review. It
                        does not approve the document or claim that DocuSign has
                        the same bytes.
                      </p>
                    </div>
                  </article>
                ) : null}
              </div>

              <div className="mt-5 rounded-2xl border border-white/[0.08] bg-black/10 px-4 py-3">
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Review packet identity · revision{" "}
                  {data.legalReviewPacket.packetRevision}
                </p>
                <p className="mt-1 break-all font-mono text-[9px] leading-relaxed text-foreground">
                  SHA-256 {data.legalReviewPacket.integrity.sha256}
                </p>
              </div>

              <div className="mt-8 border-t border-white/[0.08] pt-7">
                <p className={craftEyebrow}>The customer journey</p>
                <div className="mt-4 grid gap-3 md:grid-cols-5">
                  {data.legalReviewPacket.customerJourney.map((step) => (
                    <div
                      key={step.step}
                      className="rounded-2xl border border-white/[0.08] bg-black/10 p-4"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-[11px] font-semibold text-accent">
                        {step.step}
                      </span>
                      <h3 className="mt-3 text-sm font-medium">{step.title}</h3>
                      <p className="mt-2 text-[11px] leading-relaxed text-muted">
                        {step.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
                <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.035] p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-200">
                    HomeAtlas operating rules
                  </p>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {data.legalReviewPacket.operatingRules.map((rule) => (
                      <li
                        key={rule}
                        className="flex gap-2 text-xs leading-relaxed text-muted"
                      >
                        <span className="text-emerald-300">✓</span>
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-white/[0.08] bg-black/10 p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">
                    Primary California sources
                  </p>
                  <div className="mt-3 space-y-2">
                    {data.legalReviewPacket.sourceLinks.map((source) => (
                      <a
                        key={source.href}
                        href={source.href}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-xs leading-relaxed text-accent underline decoration-accent/30 underline-offset-4 hover:decoration-accent"
                      >
                        {source.label}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </GlassCard>

            <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
              <GlassCard tone="subtle" padding="lg" motion="rise">
                <p className={craftEyebrow}>Legal versions</p>
                <h2 className="mt-2 font-serif text-2xl font-light">
                  Two documents, one envelope
                </h2>
                <div className="mt-6 space-y-3">
                  {data.documentVersions.map((version) => {
                    const reviewDocument =
                      data.legalReviewPacket.documents.find(
                        (document) => document.id === version.document_kind,
                      );
                    const comparesToReviewCopy =
                      reviewDocument?.version === version.version &&
                      Boolean(version.review_copy_sha256);
                    const matchesReviewCopy =
                      comparesToReviewCopy &&
                      version.review_copy_sha256 ===
                        reviewDocument?.integrity.sha256;

                    return (
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
                        <div className="mt-3 rounded-xl border border-white/[0.07] bg-black/15 px-3 py-2.5">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">
                            Recorded review-copy hash
                          </p>
                          <p className="mt-1 break-all font-mono text-[9px] leading-relaxed text-foreground">
                            {version.review_copy_sha256
                              ? `SHA-256 ${version.review_copy_sha256}`
                              : "No internal review copy has been bound to this version."}
                          </p>
                          {comparesToReviewCopy ? (
                            <p
                              className={`mt-2 text-[10px] font-medium ${
                                matchesReviewCopy
                                  ? "text-emerald-200"
                                  : "text-amber-100"
                              }`}
                            >
                              {matchesReviewCopy
                                ? "Matches the exact review copy shown above."
                                : "Mismatch — stop review and create a new version."}
                            </p>
                          ) : null}
                        </div>
                        <div className="mt-3 rounded-xl border border-white/[0.07] bg-black/15 px-3 py-2.5">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">
                            Released-document hash
                          </p>
                          <p className="mt-1 break-all font-mono text-[9px] leading-relaxed text-foreground">
                            {version.content_sha256
                              ? `SHA-256 ${version.content_sha256}`
                              : "Not bound yet — customer sending remains blocked."}
                          </p>
                          {version.release_authority ? (
                            <p className="mt-2 text-[10px] leading-relaxed text-muted">
                              Released by {prettyStatus(version.release_authority)} · counsel review {prettyStatus(version.counsel_review_status)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
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
                              {packet.customer_email} · {packet.payment_rail === "manual_cash_check" ? "cash / check" : "Stripe card"}
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
