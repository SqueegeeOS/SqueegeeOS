"use client";

import { useCallback, useEffect, useState } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { StatusNotice } from "@/components/craft/status-notice";
import { FieldCloseoutReview } from "./field-closeout-review";
import type { FieldIssue } from "@/lib/field-records/field-closeout-review";

export function TechnicianIssueQueue({ refreshKey, onResolved }: { refreshKey?: string; onResolved: () => void }) {
  const [issues, setIssues] = useState<FieldIssue[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const reload = useCallback(() => setRefresh(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/admin/field-records/issues", { headers: getAdminRequestHeaders(), cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (!response.ok || !Array.isArray(body.issues)) throw new Error(body.error || "Could not load technician issues.");
        if (!controller.signal.aborted) { setIssues(body.issues); setHasMore(body.hasMore); }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load technician issues.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [refreshKey, refresh]);

  return <section aria-label="Technician issues" className="mb-6 rounded-2xl border border-border bg-surface p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-medium">Technician issues {loading ? "" : error ? "" : `· ${issues.length}${hasMore ? "+" : ""} open`}</h2>
      <button type="button" onClick={reload} disabled={loading} className="min-h-11 text-sm text-accent underline underline-offset-4 disabled:opacity-50">Refresh issues</button>
    </div>
    <p className="mb-3 text-xs leading-relaxed text-muted">Unresolved follow-ups and service exceptions, including previous visits.</p>
    {loading ? <p role="status" className="text-sm text-muted">Loading technician issues…</p> : error ? <StatusNotice tone="warning">{error}</StatusNotice> : issues.length ? <>
      {hasMore ? <p className="mb-3 text-sm text-muted">Showing the oldest 50. More appear as these are resolved.</p> : null}
      <ul className="space-y-4">{issues.map(issue => <li key={issue.fieldRecordId}>
        <h3 className="text-sm font-medium">{issue.clientName}</h3>
        <p className="mb-2 text-xs text-muted">{issue.technicianName} · Visit {issue.visitDate}</p>
        {issue.scopeException ? <p className="mb-2 break-words text-sm text-warning">{issue.scopeException}</p> : null}
        <FieldCloseoutReview assignmentId={issue.assignmentId} onResolved={() => { reload(); onResolved(); }} />
      </li>)}</ul>
    </> : <p className="text-sm text-muted">No unresolved technician issues.</p>}
  </section>;
}
