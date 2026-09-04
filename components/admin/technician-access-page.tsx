"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { HqFounderNav } from "@/components/admin/hq-founder-nav";
import { TechnicianDispatchBoard } from "@/components/admin/technician-dispatch-board";
import { TechnicianReadinessPanel } from "@/components/admin/technician-readiness-panel";
import { TechnicianCapacityPanel } from "@/components/admin/technician-capacity-panel";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { craftPrimaryButton, craftSecondaryButton, craftInput } from "@/lib/craft/tokens";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { useAdminUnlockedState } from "@/lib/admin/use-admin-unlocked-state";
import type {
  TechnicianAccessGrantView,
  TechnicianRosterMember,
} from "@/lib/field-operations/field-access";
import type { JobberTodayData } from "@/lib/care-operations/jobber-today-types";
import {
  buildTechnicianDispatchBoard,
  resolveTechnicianFieldPassState,
} from "@/lib/field-operations/technician-dispatch";
import { technicianFieldPassAnchorId } from "@/lib/care-operations/jobber-today-links";

interface RosterResponse {
  crew: TechnicianRosterMember[];
  grants: TechnicianAccessGrantView[];
  error?: string;
}

interface IssuedPass {
  grantId: string;
  displayName: string;
  inviteExpiresAt: string;
  installUrl: string;
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusCopy(
  grant: TechnicianAccessGrantView | null,
  referenceDate: Date,
): {
  label: string;
  className: string;
  detail: string;
} {
  const state = resolveTechnicianFieldPassState(grant, referenceDate);
  if (!grant || state === "missing") {
    return {
      label: "No pass",
      className: "border-foreground/10 bg-foreground/[0.035] text-muted",
      detail: "Create a one-time phone install link when this technician is ready.",
    };
  }
  if (state === "active") {
    return {
      label: "Active",
      className: "border-success/30 bg-success/[0.08] text-success",
      detail: `Active until removed by HQ · safety renewal ${formatDateTime(grant.sessionExpiresAt)}.`,
    };
  }
  if (state === "expiring") {
    return {
      label: "Expiring",
      className: "border-warning/30 bg-warning/[0.08] text-warning",
      detail: `Replace before ${formatDateTime(grant?.sessionExpiresAt ?? null)} to avoid field interruption.`,
    };
  }
  if (state === "expired" || state === "revoked") {
    return {
      label: state === "revoked" ? "Revoked" : "Expired",
      className: "border-danger/25 bg-danger/[0.07] text-danger",
      detail: "Create a replacement before this technician returns to the field.",
    };
  }
  return {
    label: "Invite pending",
    className: "border-warning/30 bg-warning/[0.08] text-warning",
    detail: `One-time link expires ${formatDateTime(grant.inviteExpiresAt)}.`,
  };
}

export function TechnicianAccessPage() {
  const [unlocked, setUnlocked] = useAdminUnlockedState();
  const [crew, setCrew] = useState<TechnicianRosterMember[]>([]);
  const [today, setToday] = useState<JobberTodayData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [workingUserId, setWorkingUserId] = useState<string | null>(null);
  const [issuedPass, setIssuedPass] = useState<IssuedPass | null>(null);
  const [copied, setCopied] = useState(false);
  const [smsBusy, setSmsBusy] = useState(false);
  const [smsReceipt, setSmsReceipt] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!unlocked) return;
    if (!silent) setLoading(true);
    if (!silent) setError(null);
    try {
      const [rosterResult, todayResult] = await Promise.allSettled([
        fetch("/api/admin/technicians/access-grants", {
          headers: getAdminRequestHeaders(),
          cache: "no-store",
        }),
        fetch("/api/admin/care-operations/jobber/today", {
          headers: getAdminRequestHeaders(),
          cache: "no-store",
        }),
      ]);

      if (rosterResult.status === "rejected") {
        throw new Error("Could not load the field roster.");
      }
      const rosterBody = (await rosterResult.value
        .json()
        .catch(() => null)) as RosterResponse | null;
      if (!rosterResult.value.ok || !rosterBody) {
        throw new Error(
          rosterBody?.error ?? "Could not load the field roster.",
        );
      }
      setCrew(rosterBody.crew);

      if (todayResult.status === "rejected") {
        setDispatchError("Could not load today's dispatch truth.");
      } else {
        const todayBody = (await todayResult.value
          .json()
          .catch(() => null)) as (JobberTodayData & { error?: string }) | null;
        if (!todayResult.value.ok || !todayBody) {
          setDispatchError(
            todayBody?.error ?? "Could not load today's dispatch truth.",
          );
        } else {
          setToday(todayBody);
          setDispatchError(null);
        }
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load the field roster.",
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, [unlocked]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!unlocked) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    const interval = window.setInterval(refreshWhenVisible, 60_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [load, unlocked]);

  const dispatchBoard = useMemo(
    () => (today ? buildTechnicianDispatchBoard({ roster: crew, today }) : null),
    [crew, today],
  );
  const referenceDate = today ? new Date(today.loadedAt) : new Date();

  async function issue(member: TechnicianRosterMember) {
    setSmsReceipt(null);
    setWorkingUserId(member.jobberUserId);
    setIssuedPass(null);
    setCopied(false);
    setError(null);
    try {
      const response = await fetch("/api/admin/technicians/access-grants", {
        method: "POST",
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({
          jobberUserId: member.jobberUserId,
          displayName: member.displayName,
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | {
            grantId?: string;
            inviteExpiresAt?: string;
            claimPath?: string;
            error?: string;
          }
        | null;
      if (
        !response.ok ||
        !body?.grantId ||
        !body.inviteExpiresAt ||
        !body.claimPath
      ) {
        throw new Error(body?.error ?? "Could not create Technician Access.");
      }
      setIssuedPass({
        grantId: body.grantId,
        displayName: member.displayName,
        inviteExpiresAt: body.inviteExpiresAt,
        installUrl: `${window.location.origin}${body.claimPath}`,
      });
      await load();
    } catch (issueError) {
      setError(
        issueError instanceof Error
          ? issueError.message
          : "Could not create Technician Access.",
      );
    } finally {
      setWorkingUserId(null);
    }
  }

  async function textInstallLink() {
    if (!issuedPass || smsBusy || smsReceipt) return;
    setSmsBusy(true);
    try {
      const response = await fetch(`/api/admin/technicians/access-grants/${issuedPass.grantId}/sms`, {
        method: "POST", headers: getAdminRequestHeaders(),
        body: JSON.stringify({ inviteToken: new URL(issuedPass.installUrl).searchParams.get("token") }),
      });
      const body = await response.json();
      setSmsReceipt(response.ok ? `Text status: ${body.status}${body.destinationEnding ? ` · phone ending ${body.destinationEnding}` : ""}.` : body.error || "Text not confirmed. Check delivery before retrying.");
    } catch { setSmsReceipt("Text not confirmed. Check delivery before creating another invitation."); }
    finally { setSmsBusy(false); }
  }

  async function revoke(member: TechnicianRosterMember) {
    if (!member.currentGrant) return;
    setWorkingUserId(member.jobberUserId);
    setIssuedPass(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/technicians/access-grants", {
        method: "DELETE",
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({ grantId: member.currentGrant.id }),
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Could not revoke Technician Access.");
      }
      await load();
    } catch (revokeError) {
      setError(
        revokeError instanceof Error
          ? revokeError.message
          : "Could not revoke Technician Access.",
      );
    } finally {
      setWorkingUserId(null);
    }
  }

  async function copyInstallLink() {
    if (!issuedPass) return;
    try {
      await navigator.clipboard.writeText(issuedPass.installUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (!unlocked) return <AdminPinGate onUnlock={() => setUnlocked(true)} />;

  return (
    <AmbientStage className="min-h-screen text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-5 pb-20 sm:px-6 sm:py-7">
        <HqFounderNav />

        <header className="mt-10 max-w-3xl">
          <p className="text-[10px] uppercase tracking-[0.2em] text-accent">
            HQ · Team control
          </p>
          <h1 className="mt-3 font-serif text-4xl font-light tracking-[-0.035em] sm:text-5xl">
            Give the field a key—not the building.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
            Technician Access is a private HomeAtlas role—not a shared Jobber
            login. A technician gets a clean workday, property memory, and a
            referral lane. Billing, Inbox, sales, and founder controls stay private.
          </p>
        </header>

        {dispatchBoard ? (
          <TechnicianDispatchBoard board={dispatchBoard} />
        ) : loading ? (
          <section className="mt-8 rounded-[2rem] border border-foreground/10 bg-background/60 p-10 text-center text-sm text-muted">
            Building today&apos;s dispatch board…
          </section>
        ) : null}

        {dispatchError ? (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-warning/25 bg-warning/[0.06] p-4 text-sm text-warning"
          >
            Dispatch board unavailable: {dispatchError} Technician Access controls remain
            available below.
          </p>
        ) : null}

        <TechnicianReadinessPanel />

        <TechnicianCapacityPanel />

        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            ["1", "Create one-time link", "Shown once and valid for 24 hours."],
            ["2", "Activate workspace", "Stays active while they remain on your team."],
            ["3", "Remove instantly", "The very next technician request fails closed."],
          ].map(([step, title, detail]) => (
            <div key={step} className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-accent/70">
                Step {step}
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{detail}</p>
            </div>
          ))}
        </section>

        {issuedPass ? (
          <section className="mt-6 rounded-[var(--radius-card-lg)] border border-accent/25 bg-surface-elevated p-5 sm:p-6">
            <p className="text-[10px] uppercase tracking-[0.18em] text-accent">
              Show once · {issuedPass.displayName}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/75">
              Send or open this link on the technician&apos;s phone. HomeAtlas stores
              only its hash, so this exact link cannot be recovered later.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                readOnly
                value={issuedPass.installUrl}
                aria-label="One-time Technician Access install link"
                className={`${craftInput} min-h-12 min-w-0 flex-1`}
                onFocus={(event) => event.currentTarget.select()}
              />
              <button
                type="button"
                onClick={() => void copyInstallLink()}
                className={craftSecondaryButton}
              >
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
            <button type="button" onClick={() => void textInstallLink()} disabled={smsBusy || !!smsReceipt}
              className={`mt-4 ${craftPrimaryButton}`}>
              {smsBusy ? "Sending invitation…" : "Text invite to registered phone"}
            </button>
            {smsReceipt ? <p role="status" className="mt-3 text-sm text-foreground">{smsReceipt}</p> : null}
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Expires {formatDateTime(issuedPass.inviteExpiresAt)}. Creating a new
              pass revokes the old one.
            </p>
          </section>
        ) : null}

        {error ? (
          <p role="alert" className="mt-6 rounded-xl border border-danger/25 bg-danger/[0.07] p-4 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <section className="mt-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted">
                HomeAtlas crew
              </p>
              <h2 className="mt-2 text-2xl font-semibold">Field roster</h2>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="min-h-11 rounded-full border border-foreground/10 px-4 text-xs text-muted disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {crew.length > 0 ? (
            <ul className="mt-4 grid gap-4 lg:grid-cols-2">
              {crew.map((member) => {
                const status = statusCopy(member.currentGrant, referenceDate);
                const working = workingUserId === member.jobberUserId;
                return (
                  <li
                    id={technicianFieldPassAnchorId(member.jobberUserId)}
                    key={member.jobberUserId}
                    className="scroll-mt-24 rounded-[1.4rem] border border-foreground/10 bg-surface-elevated p-5 target:ring-2 target:ring-accent/50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xl font-semibold text-foreground">{member.displayName}</p>
                        <p className="mt-1 text-xs text-muted">
                          {member.source === "homeatlas"
                            ? "HomeAtlas technician · no extra Jobber seat required"
                            : member.observedStopCount > 0
                            ? `${member.observedStopCount} mirrored stop${member.observedStopCount === 1 ? "" : "s"}`
                            : "No recent mirrored stops · revoke if off roster"}
                          {member.latestObservedAt
                            ? ` · seen ${formatDateTime(member.latestObservedAt)}`
                            : ""}
                        </p>
                      </div>
                      <span className={`rounded-full border px-3 py-1.5 text-[11px] ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-4 text-xs leading-relaxed text-muted">{status.detail}</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => void issue(member)}
                        className={craftPrimaryButton}
                      >
                        {working
                          ? "Working…"
                          : member.currentGrant
                            ? "Replace access"
                            : "Create access"}
                      </button>
                      {member.currentGrant ? (
                        <button
                          type="button"
                          disabled={working}
                          onClick={() => void revoke(member)}
                          className="min-h-12 rounded-xl border border-danger/20 px-5 text-sm text-danger disabled:opacity-50"
                        >
                          Revoke
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : loading ? (
            <div className="mt-4 rounded-2xl border border-foreground/10 p-10 text-center text-sm text-muted">
              Reading the mirrored Jobber crew…
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-warning/20 bg-warning/[0.05] p-6 text-sm leading-relaxed text-warning">
              No active technicians are available yet. Add a HomeAtlas technician
              or sync a Jobber crew member, then refresh this page.
            </div>
          )}
        </section>
      </div>
    </AmbientStage>
  );
}
