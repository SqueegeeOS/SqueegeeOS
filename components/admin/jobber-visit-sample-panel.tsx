"use client";

import { useEffect, useState } from "react";

interface ActiveMemberPropertyCandidate {
  membershipId: string;
  propertyId: string;
  homeownerName: string;
  propertyLabel: string;
}

interface PropertyLinkPreview {
  linkId: string;
  membershipId: string;
  propertyId: string;
  homeownerName: string;
  propertyLabel: string;
  membershipActive: boolean;
  linkState: "active" | "revoked";
  updatedAt: string;
}

interface VisitPreview {
  projectionId: string;
  externalVisitId: string;
  externalPropertyId: string;
  jobberPropertyWebUri: string | null;
  title: string | null;
  clientName: string;
  visitStatus: string;
  scheduledStart: string | null;
  isComplete: boolean;
  matchState: "manual_review" | "matched" | "ignored";
  propertyClassification:
    | "jobber_only"
    | "homeatlas_member_property"
    | "link_attention";
  propertyLink: PropertyLinkPreview | null;
  visitAuthority: "manual_review";
  billingEligible: false;
}

interface MatchingWorkspace {
  executionMode: "supervised_property_classification";
  defaultClassification: "jobber_only";
  automaticMatching: false;
  obligationMatching: false;
  billingEnabled: false;
  candidateLimitReached: boolean;
  activeMemberProperties: ActiveMemberPropertyCandidate[];
  visits: VisitPreview[];
}

interface MatchResponse {
  outcome?: string;
  workspace?: MatchingWorkspace;
  error?: string;
}

async function requestMatchingWorkspace(): Promise<MatchingWorkspace> {
  const response = await fetch(
    "/api/admin/care-operations/jobber/property-links",
    { cache: "no-store" },
  );
  const body = (await response.json().catch(() => null)) as
    | (MatchingWorkspace & { error?: string })
    | null;
  if (!response.ok || !body) {
    throw new Error(body?.error ?? "Could not load Jobber property review");
  }
  return body;
}

function formatVisitTime(value: string | null): string {
  if (!value) return "Unscheduled";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function JobberVisitSamplePanel() {
  const [workspace, setWorkspace] = useState<MatchingWorkspace | null>(null);
  const [selectedMemberships, setSelectedMemberships] = useState<
    Record<string, string>
  >({});
  const [confirmedProperties, setConfirmedProperties] = useState<
    Record<string, boolean>
  >({});
  const [loading, setLoading] = useState(true);
  const [savingProjectionId, setSavingProjectionId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    requestMatchingWorkspace()
      .then((result) => {
        if (!cancelled) setWorkspace(result);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load Jobber property review",
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
    const refreshWorkspace = () => {
      void requestMatchingWorkspace()
        .then(setWorkspace)
        .catch(() => {
          setError("Schedule refreshed, but property review could not reload.");
        });
    };
    window.addEventListener("jobber-schedule-refreshed", refreshWorkspace);
    return () => {
      window.removeEventListener("jobber-schedule-refreshed", refreshWorkspace);
    };
  }, []);

  const writePropertyLink = async (
    visit: VisitPreview,
    action: "link" | "revoke",
  ) => {
    const membershipId = selectedMemberships[visit.projectionId];
    if (action === "link" && !membershipId) return;
    if (
      action === "revoke" &&
      !window.confirm(
        "Remove this property link? The Jobber work will return to Jobber-only. No history will be deleted.",
      )
    ) {
      return;
    }

    setSavingProjectionId(visit.projectionId);
    setError(null);
    try {
      const response = await fetch(
        "/api/admin/care-operations/jobber/property-links",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            projectionId: visit.projectionId,
            membershipId: action === "link" ? membershipId : undefined,
            samePhysicalPropertyConfirmed:
              action === "link"
                ? confirmedProperties[visit.projectionId] === true
                : undefined,
            expectedLinkUpdatedAt: visit.propertyLink?.updatedAt ?? null,
          }),
        },
      );
      const body = (await response.json().catch(() => null)) as
        | MatchResponse
        | null;
      if (!response.ok || !body?.workspace) {
        throw new Error(body?.error ?? "The property link was not changed");
      }
      setWorkspace(body.workspace);
      setSelectedMemberships((current) => ({
        ...current,
        [visit.projectionId]: "",
      }));
      setConfirmedProperties((current) => ({
        ...current,
        [visit.projectionId]: false,
      }));
    } catch (writeError) {
      setError(
        writeError instanceof Error
          ? writeError.message
          : "The property link was not changed",
      );
    } finally {
      setSavingProjectionId(null);
    }
  };

  return (
    <div className="mt-8 border-t border-border/70 pt-7">
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted">
          Supervised property classification
        </p>
        <h3 className="mt-2 font-serif text-xl font-light text-foreground">
          Separate Jobber work from HomeAtlas
        </h3>
        <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted">
          No property link means Jobber-only. A confirmed link identifies a
          member property, but the visit still cannot fulfill a promise, appear
          in the portal, or become billable.
        </p>
      </div>
      {workspace?.candidateLimitReached ? (
        <p className="mt-4 text-xs text-amber-400">
          The active-member list reached its supervised review limit. Stop and
          narrow the member list before linking.
        </p>
      ) : null}
      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

      {workspace?.visits.length ? (
        <div className="mt-5 space-y-3">
          {workspace.visits.map((visit) => {
            const linked =
              visit.propertyClassification === "homeatlas_member_property";
            const attention = visit.propertyClassification === "link_attention";
            const selectedMembership =
              selectedMemberships[visit.projectionId] ?? "";
            const confirmed =
              confirmedProperties[visit.projectionId] === true;
            const saving = savingProjectionId === visit.projectionId;

            return (
              <article
                key={visit.projectionId}
                className="rounded-2xl border border-border/70 bg-foreground/[0.025] p-4"
              >
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">
                      {visit.title || "Untitled visit"}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {visit.clientName} · {formatVisitTime(visit.scheduledStart)}
                    </p>
                    {visit.jobberPropertyWebUri ? (
                      <a
                        href={visit.jobberPropertyWebUri}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex text-xs text-accent underline decoration-accent/30 underline-offset-4"
                      >
                        Open property in Jobber ↗
                      </a>
                    ) : (
                      <p className="mt-2 text-xs text-amber-400">
                        Refresh visits before matching this property.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em]">
                    <span className="rounded-full border border-border px-2.5 py-1 text-muted">
                      {visit.visitStatus}
                    </span>
                    <span className="rounded-full border border-border px-2.5 py-1 text-muted">
                      Visit review required
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-1 ${
                        linked
                          ? "border-accent/30 bg-accent/10 text-accent"
                          : attention
                            ? "border-red-500/30 bg-red-500/10 text-red-400"
                            : "border-border bg-foreground/[0.03] text-muted"
                      }`}
                    >
                      {linked
                        ? "Member property"
                        : attention
                          ? "Link needs attention"
                          : "Jobber only"}
                    </span>
                  </div>
                </div>

                {visit.propertyLink?.linkState === "active" ? (
                  <div className="mt-4 rounded-xl border border-accent/20 bg-accent/[0.05] p-4">
                    <p className="text-sm text-foreground">
                      {visit.propertyLink.homeownerName}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      {visit.propertyLink.propertyLabel}
                    </p>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-muted">
                        Property identity only. This visit is not HomeAtlas Care
                        until an obligation is confirmed later.
                      </p>
                      <button
                        type="button"
                        onClick={() => void writePropertyLink(visit, "revoke")}
                        disabled={savingProjectionId !== null}
                        className="shrink-0 rounded-full border border-border px-4 py-2 text-xs text-muted transition hover:text-foreground disabled:opacity-50"
                      >
                        {saving ? "Removing…" : "Remove property link"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-border/70 p-4">
                    {workspace.activeMemberProperties.length === 0 ? (
                      <p className="text-xs leading-relaxed text-muted">
                        There are no strictly active HomeAtlas member properties
                        available. This work remains Jobber-only.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <label className="block">
                          <span className="text-[10px] uppercase tracking-[0.14em] text-muted">
                            Active HomeAtlas member property
                          </span>
                          <select
                            value={selectedMembership}
                            onChange={(event) =>
                              setSelectedMemberships((current) => ({
                                ...current,
                                [visit.projectionId]: event.target.value,
                              }))
                            }
                            disabled={
                              !visit.jobberPropertyWebUri ||
                              workspace.candidateLimitReached ||
                              savingProjectionId !== null
                            }
                            className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground disabled:opacity-50"
                          >
                            <option value="">Choose a member property…</option>
                            {workspace.activeMemberProperties.map((candidate) => (
                              <option
                                key={candidate.membershipId}
                                value={candidate.membershipId}
                              >
                                {candidate.homeownerName} — {candidate.propertyLabel}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="flex items-start gap-3 text-xs leading-relaxed text-muted">
                          <input
                            type="checkbox"
                            checked={confirmed}
                            onChange={(event) =>
                              setConfirmedProperties((current) => ({
                                ...current,
                                [visit.projectionId]: event.target.checked,
                              }))
                            }
                            disabled={
                              !visit.jobberPropertyWebUri ||
                              workspace.candidateLimitReached ||
                              savingProjectionId !== null
                            }
                            className="mt-0.5 size-4 accent-[var(--accent)]"
                          />
                          I opened the Jobber property and verified that it is
                          the same physical address as the selected HomeAtlas
                          property.
                        </label>

                        <button
                          type="button"
                          onClick={() => void writePropertyLink(visit, "link")}
                          disabled={
                            !visit.jobberPropertyWebUri ||
                            workspace.candidateLimitReached ||
                            !selectedMembership ||
                            !confirmed ||
                            savingProjectionId !== null
                          }
                          className="rounded-full border border-accent/40 bg-accent/10 px-5 py-2.5 text-sm text-accent transition hover:bg-accent/15 disabled:opacity-40"
                        >
                          {saving ? "Linking…" : "Confirm member property"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : loading ? (
        <p className="mt-5 text-xs text-muted">Checking Jobber properties…</p>
      ) : (
        <p className="mt-5 text-xs text-muted">No visits observed yet.</p>
      )}
    </div>
  );
}
