"use client";

import { useCallback, useEffect, useState } from "react";
import { HQ_MEMBERSHIP_APPOINTMENT_TYPES } from "@/lib/membership/membership-appointment-types";

interface ClassificationPreview {
  classificationId: string;
  state: "pending_review" | "approved" | "rejected" | "revoked";
  serviceType: string;
  appointmentId: string | null;
  reviewedSourcePayloadHash: string;
  reviewedPropertyLinkId: string;
  reviewedPropertyLinkUpdatedAt: string;
  updatedAt: string;
}

interface VisitPreview {
  projectionId: string;
  externalVisitId: string;
  title: string | null;
  clientName: string;
  visitStatus: string;
  scheduledStart: string | null;
  sourcePayloadHash: string;
  propertyLink: {
    linkId: string;
    membershipId: string;
    propertyId: string;
    homeownerName: string;
    propertyLabel: string;
    updatedAt: string;
    linkState: "active" | "revoked";
  } | null;
  classification: ClassificationPreview | null;
  appointment: {
    appointmentId: string;
    status: "scheduled" | "completed" | "cancelled" | "no_show";
    completedAt: string | null;
    authorityState: string | null;
  } | null;
  completion: {
    completionEventId: string;
    completedAt: string;
  } | null;
  promotionReadiness:
    | "ready_for_review"
    | "coverage_not_ready"
    | "property_link_required"
    | "provider_state_not_promotable";
  promotionBlockReason: string | null;
  completionReadiness:
    | "ready_for_confirmation"
    | "already_completed"
    | "coverage_not_ready"
    | "prior_approval_required"
    | "property_link_required"
    | "provider_state_not_complete";
  completionBlockReason: string | null;
}

interface ClassificationWorkspace {
  visitLimitReached: boolean;
  coverage: {
    state: "complete" | "partial" | "stale";
    fresh: boolean;
    syncInProgress: boolean;
    decisionsEnabled: boolean;
    coveredAt: string | null;
    routeCompletenessClaimed: false;
  };
  visits: VisitPreview[];
}

interface DecisionDraft {
  serviceType: string;
  reason: string;
  evidenceText: string;
  evidenceId: string | null;
}

async function loadWorkspace(): Promise<ClassificationWorkspace> {
  const response = await fetch(
    "/api/admin/care-operations/jobber/visit-classifications",
    { cache: "no-store" },
  );
  const body = (await response.json().catch(() => null)) as
    | (ClassificationWorkspace & { error?: string })
    | null;
  if (!response.ok || !body) {
    throw new Error(body?.error ?? "Could not load visit review");
  }
  return body;
}

function formatVisitTime(value: string | null): string {
  if (!value) return "No scheduled time";
  return new Date(value).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function stateLabel(state: ClassificationPreview["state"]): string {
  if (state === "approved") return "Approved schedule";
  if (state === "rejected") return "Rejected";
  if (state === "revoked") return "Revoked";
  return "Review required";
}

export function JobberVisitClassificationPanel() {
  const [workspace, setWorkspace] = useState<ClassificationWorkspace | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DecisionDraft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setWorkspace(await loadWorkspace());
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load visit review",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadWorkspace()
      .then((result) => {
        if (!cancelled) setWorkspace(result);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load visit review",
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
    const reload = () => void refresh();
    window.addEventListener("jobber-schedule-refreshed", reload);
    window.addEventListener("jobber-property-link-changed", reload);
    return () => {
      window.removeEventListener("jobber-schedule-refreshed", reload);
      window.removeEventListener("jobber-property-link-changed", reload);
    };
  }, [refresh]);

  const decide = async (visit: VisitPreview, action: "approve" | "reject") => {
    const draft = drafts[visit.projectionId];
    if (!draft?.serviceType || !draft.reason.trim() || !visit.propertyLink) return;
    setSavingId(visit.projectionId);
    setError(null);
    try {
      const response = await fetch(
        "/api/admin/care-operations/jobber/visit-classifications",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            projectionId: visit.projectionId,
            sourcePayloadHash: visit.sourcePayloadHash,
            propertyLinkId: visit.propertyLink.linkId,
            propertyLinkUpdatedAt: visit.propertyLink.updatedAt,
            membershipId: visit.propertyLink.membershipId,
            propertyId: visit.propertyLink.propertyId,
            serviceType: draft.serviceType,
            reason: draft.reason,
          }),
        },
      );
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "The visit decision was not recorded");
      }
      setDrafts((current) => ({
        ...current,
        [visit.projectionId]: {
          serviceType: "",
          reason: "",
          evidenceText: "",
          evidenceId: null,
        },
      }));
      await refresh();
    } catch (writeError) {
      setError(
        writeError instanceof Error
          ? writeError.message
          : "The visit decision was not recorded",
      );
    } finally {
      setSavingId(null);
    }
  };

  const confirmCompletion = async (visit: VisitPreview) => {
    const classification = visit.classification;
    const appointment = visit.appointment;
    const reason = drafts[visit.projectionId]?.reason.trim();
    if (!classification || !appointment || !visit.propertyLink || !reason) return;
    setSavingId(visit.projectionId);
    setError(null);
    try {
      const response = await fetch(
        "/api/admin/care-operations/jobber/visit-completions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appointmentId: appointment.appointmentId,
            projectionId: visit.projectionId,
            sourcePayloadHash: visit.sourcePayloadHash,
            classificationId: classification.classificationId,
            classificationUpdatedAt: classification.updatedAt,
            propertyLinkUpdatedAt: visit.propertyLink.updatedAt,
            reason,
          }),
        },
      );
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "The completion was not confirmed");
      }
      await refresh();
    } catch (writeError) {
      setError(
        writeError instanceof Error
          ? writeError.message
          : "The completion was not confirmed",
      );
    } finally {
      setSavingId(null);
    }
  };

  const recordEvidence = async (visit: VisitPreview) => {
    const appointment = visit.appointment;
    const draft = drafts[visit.projectionId];
    if (!appointment || !draft?.evidenceText.trim()) return;
    const evidenceId = draft.evidenceId ?? crypto.randomUUID();
    setDrafts((current) => ({
      ...current,
      [visit.projectionId]: { ...draft, evidenceId },
    }));
    setSavingId(visit.projectionId);
    setError(null);
    try {
      const response = await fetch(
        "/api/admin/care-operations/jobber/visit-completions/evidence",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            evidenceId,
            appointmentId: appointment.appointmentId,
            evidenceText: draft.evidenceText,
          }),
        },
      );
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "The visit evidence was not recorded");
      }
      setDrafts((current) => ({
        ...current,
        [visit.projectionId]: {
          ...draft,
          evidenceText: "",
          evidenceId: null,
        },
      }));
    } catch (writeError) {
      setError(
        writeError instanceof Error
          ? writeError.message
          : "The visit evidence was not recorded",
      );
    } finally {
      setSavingId(null);
    }
  };

  const revoke = async (visit: VisitPreview) => {
    const classification = visit.classification;
    const reason = drafts[visit.projectionId]?.reason.trim();
    if (!classification || !reason) return;
    setSavingId(visit.projectionId);
    setError(null);
    try {
      const response = await fetch(
        "/api/admin/care-operations/jobber/visit-classifications/revoke",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            classificationId: classification.classificationId,
            expectedUpdatedAt: classification.updatedAt,
            reason,
          }),
        },
      );
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "The classification was not revoked");
      }
      await refresh();
    } catch (writeError) {
      setError(
        writeError instanceof Error
          ? writeError.message
          : "The classification was not revoked",
      );
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="mt-8 border-t border-border/70 pt-7">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted">
        Supervised visit decisions
      </p>
      <h3 className="mt-2 font-serif text-xl font-light text-foreground">
        Approve one exact schedule at a time
      </h3>
      <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted">
        Choose the HomeAtlas service type from the approved list and record why
        this exact Jobber visit belongs on the member schedule. Jobber titles
        are evidence only and never choose the service automatically.
      </p>
      {workspace ? (
        <p className="mt-3 text-xs text-muted">
          Coverage is {workspace.coverage.state}
          {workspace.coverage.fresh ? " and fresh" : ""}
          {workspace.coverage.syncInProgress ? " with a sync in progress" : ""}.
          This list never
          claims the route is complete; partial or stale coverage remains
          visibly incomplete.
        </p>
      ) : null}
      {workspace?.visitLimitReached ? (
        <p className="mt-3 text-xs text-amber-300">
          The supervised list reached its 100-visit bound. Stop before treating
          this view as the full schedule.
        </p>
      ) : null}
      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

      <div className="mt-5 space-y-3">
        {(workspace?.visits ?? []).map((visit) => {
          const draft = drafts[visit.projectionId] ?? {
            serviceType: visit.classification?.serviceType ?? "",
            reason: "",
            evidenceText: "",
            evidenceId: null,
          };
          const approved = visit.classification?.state === "approved";
          const authoritativeCompleted =
            visit.completionReadiness === "already_completed";
          const decisionInputsDisabled =
            savingId !== null ||
            authoritativeCompleted ||
            (!approved && !workspace?.coverage.decisionsEnabled);
          const canRecordDecision =
            Boolean(workspace?.coverage.decisionsEnabled) &&
            Boolean(visit.propertyLink) &&
            Boolean(draft.serviceType) &&
            Boolean(draft.reason.trim()) &&
            savingId === null;
          const canApprove =
            canRecordDecision &&
            visit.promotionReadiness === "ready_for_review";
          return (
            <article
              key={visit.projectionId}
              className="rounded-2xl border border-border/70 bg-foreground/[0.025] p-4"
            >
              <div className="flex flex-col justify-between gap-3 sm:flex-row">
                <div>
                  <p className="text-sm text-foreground">
                    {visit.title || "Untitled Jobber visit"}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {visit.clientName} · {formatVisitTime(visit.scheduledStart)}
                  </p>
                </div>
                <span className="self-start rounded-full border border-border px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-muted">
                  {visit.classification
                    ? authoritativeCompleted
                      ? "Completed"
                      : stateLabel(visit.classification.state)
                    : "Unclassified"}
                </span>
              </div>

              {visit.propertyLink ? (
                <p className="mt-3 text-xs leading-relaxed text-muted">
                  {visit.propertyLink.homeownerName} · {visit.propertyLink.propertyLabel}
                </p>
              ) : null}
              {visit.promotionBlockReason ? (
                <p className="mt-3 text-xs text-amber-300">
                  {visit.promotionBlockReason}
                </p>
              ) : null}
              {visit.completionBlockReason && visit.visitStatus === "COMPLETED" ? (
                <p className="mt-3 text-xs text-amber-300">
                  Completion held: {visit.completionBlockReason}
                </p>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-muted">
                    HomeAtlas service type
                  </span>
                  <select
                    value={draft.serviceType}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [visit.projectionId]: {
                          ...draft,
                          serviceType: event.target.value,
                        },
                      }))
                    }
                    disabled={approved || decisionInputsDisabled}
                    className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground disabled:opacity-50"
                  >
                    <option value="">Choose explicitly…</option>
                    {HQ_MEMBERSHIP_APPOINTMENT_TYPES.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-muted">
                    Decision reason
                  </span>
                  <input
                    maxLength={1000}
                    value={draft.reason}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [visit.projectionId]: {
                          ...draft,
                          reason: event.target.value,
                        },
                      }))
                    }
                    placeholder={approved ? "Reason required to revoke" : "What did you verify?"}
                    disabled={decisionInputsDisabled}
                    className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted/60 disabled:opacity-50"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {authoritativeCompleted ? null : approved ? (
                  <button
                    type="button"
                    onClick={() => void revoke(visit)}
                    disabled={!draft.reason.trim() || savingId !== null}
                    className="rounded-full border border-border px-4 py-2 text-xs text-muted transition hover:text-foreground disabled:opacity-40"
                  >
                    {savingId === visit.projectionId ? "Revoking…" : "Revoke approval"}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void decide(visit, "approve")}
                      disabled={!canApprove}
                      className="rounded-full border border-accent/40 bg-accent/10 px-5 py-2.5 text-sm text-accent transition hover:bg-accent/15 disabled:opacity-40"
                    >
                      {savingId === visit.projectionId ? "Recording…" : "Approve schedule"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void decide(visit, "reject")}
                      disabled={!canRecordDecision}
                      className="rounded-full border border-border px-4 py-2 text-xs text-muted transition hover:text-foreground disabled:opacity-40"
                    >
                      Reject
                    </button>
                  </>
                )}
                {visit.completionReadiness === "ready_for_confirmation" ? (
                  <button
                    type="button"
                    onClick={() => void confirmCompletion(visit)}
                    disabled={!draft.reason.trim() || savingId !== null}
                    className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-5 py-2.5 text-sm text-emerald-300 transition hover:bg-emerald-500/15 disabled:opacity-40"
                  >
                    {savingId === visit.projectionId
                      ? "Confirming…"
                      : "Confirm Jobber completion"}
                  </button>
                ) : null}
              </div>

              {visit.completionReadiness === "already_completed" ? (
                <div className="mt-5 border-t border-border/70 pt-4">
                  <p className="text-xs text-emerald-300">
                    Authoritatively completed {formatVisitTime(visit.completion?.completedAt ?? null)}
                  </p>
                  <label className="mt-3 block">
                    <span className="text-[10px] uppercase tracking-[0.14em] text-muted">
                      Immutable visit evidence · text only
                    </span>
                    <textarea
                      maxLength={4000}
                      rows={3}
                      value={draft.evidenceText}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [visit.projectionId]: {
                            ...draft,
                            evidenceText: event.target.value,
                            evidenceId: draft.evidenceId,
                          },
                        }))
                      }
                      placeholder="Record only what was directly verified. This is private HQ evidence and is not published to the customer."
                      disabled={savingId !== null}
                      className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground placeholder:text-muted/60 disabled:opacity-50"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void recordEvidence(visit)}
                    disabled={!draft.evidenceText.trim() || savingId !== null}
                    className="mt-3 rounded-full border border-border px-4 py-2 text-xs text-muted transition hover:text-foreground disabled:opacity-40"
                  >
                    {savingId === visit.projectionId ? "Recording…" : "Record immutable evidence"}
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      {loading ? <p className="mt-5 text-xs text-muted">Loading visit review…</p> : null}
      {!loading && workspace?.visits.length === 0 ? (
        <p className="mt-5 text-xs text-muted">No synced visits are available for review.</p>
      ) : null}
    </div>
  );
}
