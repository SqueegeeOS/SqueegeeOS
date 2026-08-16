"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import {
  deriveSalesRepLaunchReadiness,
  type SalesRepLaunchCountsEvidence,
} from "@/lib/sales/rep-launch-readiness";

interface GrantView {
  id: string;
  status: "pending" | "active" | "revoked";
  inviteExpiresAt: string;
  sessionExpiresAt: string | null;
}

interface RosterMember {
  repId: string;
  repSlug: string;
  displayName: string;
  roleTitle: string;
  currentGrant: GrantView | null;
  launchEvidence: SalesRepLaunchCountsEvidence;
}

interface RosterResponse {
  reps: RosterMember[];
  error?: string;
}

interface IssuedPass {
  displayName: string;
  installUrl: string;
  inviteExpiresAt: string;
}

function formatDateTime(value: string | null): string {
  if (!value) return "Not installed";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(date)
    : "Unavailable";
}

function grantStatus(grant: GrantView | null): {
  label: string;
  detail: string;
  className: string;
} {
  if (!grant) {
    return {
      label: "No phone pass",
      detail: "Create a one-time install link when the rep's phone is ready.",
      className: "border-white/10 bg-white/[0.025] text-white/50",
    };
  }
  if (grant.status === "active") {
    return {
      label: "Phone active",
      detail: `Session expires ${formatDateTime(grant.sessionExpiresAt)}.`,
      className:
        "border-emerald-300/25 bg-emerald-300/[0.07] text-emerald-100",
    };
  }
  return {
    label: "Install link ready",
    detail: `One-time link expires ${formatDateTime(grant.inviteExpiresAt)}.`,
    className:
      "border-amber-300/25 bg-amber-300/[0.07] text-amber-100",
  };
}

export function SalesPhoneAccessPanel() {
  const [reps, setReps] = useState<RosterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workingRep, setWorkingRep] = useState<string | null>(null);
  const [issuedPass, setIssuedPass] = useState<IssuedPass | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/sales/access-grants", {
        headers: getAdminRequestHeaders(),
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as
        | RosterResponse
        | null;
      if (!response.ok || !body) {
        throw new Error(body?.error ?? "Could not load sales phone access.");
      }
      setReps(body.reps);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load sales phone access.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function issue(rep: RosterMember) {
    setWorkingRep(rep.repSlug);
    setIssuedPass(null);
    setCopied(false);
    setError(null);
    try {
      const response = await fetch("/api/admin/sales/access-grants", {
        method: "POST",
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({ repSlug: rep.repSlug }),
      });
      const body = (await response.json().catch(() => null)) as
        | {
            claimPath?: string;
            inviteExpiresAt?: string;
            displayName?: string;
            error?: string;
          }
        | null;
      if (
        !response.ok ||
        !body?.claimPath ||
        !body.inviteExpiresAt ||
        !body.displayName
      ) {
        throw new Error(body?.error ?? "Could not create the phone pass.");
      }
      setIssuedPass({
        displayName: body.displayName,
        inviteExpiresAt: body.inviteExpiresAt,
        installUrl: `${window.location.origin}${body.claimPath}`,
      });
      await load();
    } catch (issueError) {
      setError(
        issueError instanceof Error
          ? issueError.message
          : "Could not create the phone pass.",
      );
    } finally {
      setWorkingRep(null);
    }
  }

  async function revoke(rep: RosterMember) {
    if (!rep.currentGrant) return;
    setWorkingRep(rep.repSlug);
    setIssuedPass(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/sales/access-grants", {
        method: "DELETE",
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({ grantId: rep.currentGrant.id }),
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Could not revoke the phone pass.");
      }
      await load();
    } catch (revokeError) {
      setError(
        revokeError instanceof Error
          ? revokeError.message
          : "Could not revoke the phone pass.",
      );
    } finally {
      setWorkingRep(null);
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

  return (
    <section
      id="sales-phone-access"
      className="mt-12 scroll-mt-28 overflow-hidden rounded-[2rem] border border-emerald-300/15 bg-[radial-gradient(circle_at_88%_0%,rgba(110,231,183,0.09),transparent_34%),rgba(13,18,16,0.88)] p-5 sm:p-8"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-[10px] uppercase tracking-[0.22em] text-emerald-200/70">
            Sales phone access
          </p>
          <h2 className="mt-2 font-serif text-3xl text-[#f5f2eb]">
            Give each rep their desk—not your HQ PIN.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/46">
            A one-time link installs a revocable 30-day session scoped to that
            rep&apos;s leads, presentations, and verified closes. Creating a link
            does not text, email, charge, or alter a customer.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="min-h-11 rounded-full border border-white/10 px-4 text-xs text-white/55 hover:border-emerald-300/25 hover:text-emerald-100 disabled:opacity-40"
        >
          {loading ? "Checking…" : "Refresh passes"}
        </button>
      </div>

      {error ? (
        <div role="alert" className="mt-5 rounded-2xl border border-red-300/20 bg-red-300/[0.06] p-4 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      {issuedPass ? (
        <div className="mt-6 rounded-2xl border border-emerald-300/25 bg-emerald-300/[0.06] p-4 sm:p-5">
          <p className="text-[10px] uppercase tracking-[0.17em] text-emerald-200/75">
            {issuedPass.displayName}&apos;s one-time install link
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={issuedPass.installUrl}
              aria-label="One-time sales phone install link"
              className="min-h-12 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 text-xs text-white/72 outline-none"
              onFocus={(event) => event.currentTarget.select()}
            />
            <button
              type="button"
              onClick={() => void copyInstallLink()}
              className="min-h-12 rounded-xl bg-emerald-200 px-5 text-xs font-semibold text-[#07110c]"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          <p className="mt-2 text-xs text-white/38">
            Open it on that phone before {formatDateTime(issuedPass.inviteExpiresAt)}.
            The link disappears after installation.
          </p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        {reps.map((rep) => {
          const status = grantStatus(rep.currentGrant);
          const working = workingRep === rep.repSlug;
          const readiness = deriveSalesRepLaunchReadiness({
            phonePass:
              rep.currentGrant?.status === "active"
                ? "installed"
                : rep.currentGrant?.status === "pending"
                  ? "install_link_ready"
                  : "missing",
            counts: rep.launchEvidence,
          });
          return (
            <article
              key={rep.repId}
              className="rounded-2xl border border-white/[0.08] bg-black/20 p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-serif text-xl text-[#f5f2eb]">
                    {rep.displayName}
                  </p>
                  <p className="mt-1 text-xs text-white/38">{rep.roleTitle}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-[9px] uppercase tracking-[0.13em] ${status.className}`}>
                  {status.label}
                </span>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-white/42">
                {status.detail}
              </p>
              <div className="mt-4 rounded-2xl border border-white/[0.07] bg-black/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/42">
                    First durable loop
                  </p>
                  <p className="text-[10px] tabular-nums text-emerald-100/70">
                    {readiness.completedCount}/{readiness.totalCount} proven
                  </p>
                </div>
                <div
                  className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5"
                  aria-label={`${rep.displayName}'s first field revenue loop`}
                >
                  {readiness.steps.map((step) => (
                    <div
                      key={step.id}
                      className={`rounded-xl border px-2.5 py-2.5 ${
                        step.state === "complete"
                          ? "border-emerald-300/20 bg-emerald-300/[0.065]"
                          : step.state === "unknown"
                            ? "border-amber-300/20 bg-amber-300/[0.05]"
                            : "border-white/[0.07] bg-white/[0.02]"
                      }`}
                    >
                      <p
                        className={`text-[9px] font-semibold uppercase tracking-[0.1em] ${
                          step.state === "complete"
                            ? "text-emerald-100"
                            : step.state === "unknown"
                              ? "text-amber-100/75"
                              : "text-white/45"
                        }`}
                      >
                        {step.state === "complete"
                          ? "✓ "
                          : step.state === "unknown"
                            ? "? "
                            : "○ "}
                        {step.label}
                      </p>
                      <p className="mt-1 text-[9px] leading-4 text-white/32">
                        {step.detail}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-5 text-white/52">
                  <span className="font-semibold text-emerald-100/80">Next:</span>{" "}
                  {readiness.nextAction}
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void issue(rep)}
                  disabled={working}
                  className="min-h-11 rounded-full bg-emerald-200 px-4 text-xs font-semibold text-[#07110c] disabled:opacity-45"
                >
                  {working
                    ? "Working…"
                    : rep.currentGrant
                      ? "Replace phone pass"
                      : "Create phone pass"}
                </button>
                {rep.currentGrant ? (
                  <button
                    type="button"
                    onClick={() => void revoke(rep)}
                    disabled={working}
                    className="min-h-11 rounded-full border border-red-300/20 px-4 text-xs text-red-100/75 disabled:opacity-45"
                  >
                    Revoke
                  </button>
                ) : null}
                <Link
                  href={rep.repSlug === "david" ? "/david" : `/sales/${rep.repSlug}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-white/10 px-4 text-xs text-white/52"
                >
                  Open as HQ
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
