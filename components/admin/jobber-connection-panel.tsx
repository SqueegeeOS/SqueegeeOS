"use client";

import { useCallback, useEffect, useState } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { JobberCustomerPairingPanel } from "@/components/admin/jobber-customer-pairing-panel";
import { JobberVisitWorkspacePanel } from "@/components/admin/jobber-visit-workspace-panel";
import { craftEyebrow, craftPrimaryButton } from "@/lib/craft/tokens";
import {
  jobberHandoffResumeHref,
  type JobberHandoffFocus,
} from "@/lib/care-operations/jobber-handoff-navigation";

interface JobberConnectionResponse {
  configuration: {
    clientIdConfigured: boolean;
    clientSecretConfigured: boolean;
    encryptionKeyConfigured: boolean;
    redirectUriConfigured: boolean;
    configured: boolean;
  };
  redirectUri: string | null;
  connection: {
    connected: boolean;
    status: string;
    accountName: string | null;
    graphqlVersion: string;
    connectedAt: string | null;
    lastVerifiedAt: string | null;
  } | null;
  error?: string;
}

interface JobberSyncSection {
  observed: number;
  pagesRead: number;
  inserted: number;
  changed: number;
  unchanged: number;
  addressReadState?: "available" | "unavailable";
  addressFields?: string[];
}

interface JobberSyncResponse {
  clients: JobberSyncSection;
  visits: JobberSyncSection;
  autoLinking: {
    executionMode: "strict_exact_only";
    billingEnabled: false;
    evaluated: number;
    linked: number;
    alreadyLinked: number;
    manualReview: number;
    insufficientEvidence: number;
    conflictsBlocked: number;
    revocationsRespected: number;
    archivedSkipped: number;
    portalRepairsNeeded: number;
  };
  completedAt: string;
  error?: string;
}

async function requestJobberConnectionStatus(): Promise<JobberConnectionResponse> {
  const response = await fetch(
    "/api/admin/care-operations/jobber/oauth/status",
    { headers: getAdminRequestHeaders(), cache: "no-store" },
  );
  const body = (await response.json().catch(() => null)) as
    | JobberConnectionResponse
    | null;
  if (!response.ok || !body) {
    throw new Error(body?.error ?? "Could not read Jobber connection status");
  }
  return body;
}

function ConfigurationItem({ label, ready }: { label: string; ready: boolean }) {
  return (
    <li className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted">{label}</span>
      <span className={ready ? "text-emerald-300" : "text-amber-300"}>
        {ready ? "Ready" : "Missing"}
      </span>
    </li>
  );
}

export function JobberConnectionPanel({
  focus,
}: {
  focus: JobberHandoffFocus | null;
}) {
  const focusMembershipId = focus?.membershipId ?? null;
  const focusProjectionId = focus?.projectionId ?? null;
  const [status, setStatus] = useState<JobberConnectionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncSummary, setSyncSummary] = useState<JobberSyncResponse | null>(
    null,
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStatus(await requestJobberConnectionStatus());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not read Jobber connection status",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    requestJobberConnectionStatus()
      .then((nextStatus) => {
        if (!cancelled) setStatus(nextStatus);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not read Jobber connection status",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      (!focusMembershipId && !focusProjectionId) ||
      !status?.connection?.connected
    ) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById("jobber-visits")
        ?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    focusMembershipId,
    focusProjectionId,
    refreshKey,
    status?.connection?.connected,
  ]);

  const connect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const response = await fetch(
        "/api/admin/care-operations/jobber/oauth/start",
        {
          method: "POST",
          headers: getAdminRequestHeaders(),
          body: JSON.stringify({
            returnTo: focus ? jobberHandoffResumeHref(focus) : null,
          }),
        },
      );
      const body = (await response.json().catch(() => null)) as
        | { authorizationUrl?: string; error?: string }
        | null;
      if (!response.ok || !body?.authorizationUrl) {
        throw new Error(body?.error ?? "Could not start Jobber authorization");
      }
      window.location.assign(body.authorizationUrl);
    } catch (connectError) {
      setError(
        connectError instanceof Error
          ? connectError.message
          : "Could not start Jobber authorization",
      );
      setConnecting(false);
    }
  };

  const copyRedirectUri = async () => {
    if (!status?.redirectUri) return;
    await navigator.clipboard.writeText(status.redirectUri);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const syncAll = async () => {
    setSyncing(true);
    setError(null);
    try {
      const response = await fetch(
        "/api/admin/care-operations/jobber/sync",
        {
          method: "POST",
          headers: getAdminRequestHeaders(),
        },
      );
      const body = (await response.json().catch(() => null)) as
        | JobberSyncResponse
        | null;
      if (!response.ok || !body?.clients || !body.visits) {
        throw new Error(body?.error ?? "Jobber synchronization did not finish");
      }
      setSyncSummary(body);
      setRefreshKey((value) => value + 1);
    } catch (syncError) {
      setError(
        syncError instanceof Error
          ? syncError.message
          : "Jobber synchronization did not finish",
      );
    } finally {
      setSyncing(false);
    }
  };

  return (
    <section className="mb-8 rounded-[2rem] border border-border/80 bg-background/65 p-5 sm:p-7">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div>
          <p className={craftEyebrow}>Read-only scheduling truth</p>
          <h2 className="mt-2 font-serif text-2xl font-light text-foreground">
            Jobber connection
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
            Connect the SqueegeeKing Jobber account, synchronize its complete
            read-only customer and visit index, then pair records under human
            review. HomeAtlas never changes Jobber appointments or enables
            billing from a pairing.
          </p>
        </div>
        <span
          className={`inline-flex self-start rounded-full border px-3 py-1.5 text-xs ${
            status?.connection?.connected
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-border text-muted"
          }`}
        >
          {loading
            ? "Checking…"
            : status?.connection?.connected
              ? "Connected"
              : "Not connected"}
        </span>
      </div>

      {status?.connection?.connected ? (
        <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
          <p className="text-sm text-foreground">
            {status.connection.accountName ?? "Jobber account"}
          </p>
          <p className="mt-1 text-xs text-muted">
            Identity verified · API {status.connection.graphqlVersion}
          </p>
        </div>
      ) : null}

      {status ? (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          <ConfigurationItem
            label="Client ID"
            ready={status.configuration.clientIdConfigured}
          />
          <ConfigurationItem
            label="Client secret"
            ready={status.configuration.clientSecretConfigured}
          />
          <ConfigurationItem
            label="Token encryption key"
            ready={status.configuration.encryptionKeyConfigured}
          />
          <ConfigurationItem
            label="Production callback"
            ready={status.configuration.redirectUriConfigured}
          />
        </ul>
      ) : null}

      {status?.redirectUri ? (
        <div className="mt-6">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted">
            Jobber callback URL
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-border bg-black/20 px-4 py-3 text-xs text-foreground">
              {status.redirectUri}
            </code>
            <button
              type="button"
              onClick={() => void copyRedirectUri()}
              className="rounded-full border border-border px-4 py-2 text-xs text-muted transition hover:text-foreground"
            >
              {copied ? "Copied" : "Copy callback"}
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-5 text-sm text-red-400">{error}</p> : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void connect()}
          disabled={
            loading ||
            connecting ||
            !status?.configuration.configured
          }
          className={craftPrimaryButton}
        >
          {connecting
            ? "Opening Jobber…"
            : status?.connection?.connected
              ? "Reauthorize Jobber"
              : "Connect Jobber"}
        </button>
        <button
          type="button"
          onClick={() => void loadStatus()}
          disabled={loading}
          className="rounded-full border border-border px-5 py-3 text-sm text-muted transition hover:text-foreground disabled:opacity-50"
        >
          Check again
        </button>
        {status?.connection?.connected ? (
          <button
            type="button"
            onClick={() => void syncAll()}
            disabled={loading || syncing}
            className="rounded-full border border-accent/40 bg-accent/10 px-5 py-3 text-sm text-accent transition hover:bg-accent/15 disabled:opacity-50"
          >
            {syncing ? "Synchronizing all Jobber data..." : "Sync all Jobber data"}
          </button>
        ) : null}
      </div>

      {syncSummary ? (
        <div
          className="mt-5 rounded-2xl border border-accent/20 bg-accent/[0.05] p-4 text-xs leading-relaxed text-muted"
          aria-live="polite"
        >
          <p className="text-sm text-foreground">Jobber sync complete</p>
          <p className="mt-1">
            {syncSummary.clients.observed.toLocaleString()} customers across{" "}
            {syncSummary.clients.pagesRead.toLocaleString()} pages;{" "}
            {syncSummary.visits.observed.toLocaleString()} visits across{" "}
            {syncSummary.visits.pagesRead.toLocaleString()} pages.
          </p>
          <p className="mt-1">
            New: {(
              syncSummary.clients.inserted + syncSummary.visits.inserted
            ).toLocaleString()} - Changed: {(
              syncSummary.clients.changed + syncSummary.visits.changed
            ).toLocaleString()} - Unchanged: {(
              syncSummary.clients.unchanged + syncSummary.visits.unchanged
            ).toLocaleString()}
          </p>
          <p className="mt-2 border-t border-border/60 pt-2">
            Safe customer pairing: {syncSummary.autoLinking.linked.toLocaleString()} new,{" "}
            {syncSummary.autoLinking.alreadyLinked.toLocaleString()} already paired,{" "}
            {syncSummary.autoLinking.manualReview.toLocaleString()} needing review,{" "}
            {syncSummary.autoLinking.insufficientEvidence.toLocaleString()} without
            enough exact evidence.
          </p>
          <p
            className={`mt-1 ${
              syncSummary.clients.addressReadState === "available"
                ? "text-emerald-300"
                : "text-amber-300"
            }`}
          >
            Exact address evidence: {syncSummary.clients.addressReadState === "available"
              ? "available for safe matching"
              : "unavailable - no automatic links attempted"}.
          </p>
          {syncSummary.autoLinking.conflictsBlocked > 0 ||
          syncSummary.autoLinking.revocationsRespected > 0 ||
          syncSummary.autoLinking.portalRepairsNeeded > 0 ? (
            <p className="mt-1 text-amber-300">
              Safety held {syncSummary.autoLinking.conflictsBlocked.toLocaleString()} conflict(s),
              respected {syncSummary.autoLinking.revocationsRespected.toLocaleString()} revocation(s),
              and flagged {syncSummary.autoLinking.portalRepairsNeeded.toLocaleString()} portal repair(s).
            </p>
          ) : null}
        </div>
      ) : null}

      {status?.connection?.connected ? (
        <>
          <JobberCustomerPairingPanel key={`customers-${refreshKey}`} />
          <JobberVisitWorkspacePanel
            key={`visits-${refreshKey}`}
            focus={focus}
          />
        </>
      ) : null}
    </section>
  );
}
