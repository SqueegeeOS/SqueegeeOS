"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { StatusNotice } from "@/components/craft/status-notice";
import type { FieldCloseoutReview as Review } from "@/lib/field-records/field-closeout-review";
import { hasUnresolvedFieldIssue } from "@/lib/field-records/field-closeout-review";

export function FieldCloseoutReview({ assignmentId, onResolved }: { assignmentId: string; onResolved?: () => void }) {
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const noteId = useId();

  async function resolve() {
    if (!review || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/field-records/${encodeURIComponent(assignmentId)}`, {
        method: "PATCH", headers: getAdminRequestHeaders(),
        body: JSON.stringify({ fieldRecordId: review.fieldRecordId, note }),
      });
      const body = await response.json();
      if (!response.ok || !body.resolution) throw new Error(body.error || "Could not save resolution.");
      setReview({ ...review, resolution: body.resolution });
      setNote("");
      onResolved?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save resolution. Your note is kept; try again.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function load() {
    setOpen(true);
    setLoading(true);
    setError(null);
    setReview(null);
    try {
      const response = await fetch(`/api/admin/field-records/${encodeURIComponent(assignmentId)}`, {
        headers: getAdminRequestHeaders(), cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load evidence.");
      setReview(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load evidence.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mb-4 rounded-2xl border border-accent/25 bg-accent/[0.04] p-4">
      <button type="button" disabled={loading || saving} aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left text-sm font-medium text-accent disabled:opacity-50"
        onClick={() => open ? setOpen(false) : void load()}>
        {loading ? "Opening visit evidence…" : "Review technician notes + photos"}
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open ? <div className="mt-3 space-y-4">
        {error ? <StatusNotice tone="danger">{error}</StatusNotice> : null}
        {review ? <>
          <p className="text-sm text-foreground/65">{review.technicianName} · Visit {review.visitDate}</p>
          {hasUnresolvedFieldIssue(review.followUpNeeded, review.scopeException, Boolean(review.resolution)) ? <StatusNotice tone="warning">This visit needs owner follow-up.</StatusNotice> : null}
          {([ ["Work summary", review.customerSummary], ["Internal notes", review.internalNote], ["Service exceptions", review.scopeException] ] as const).map(([label, value]) => value ? (
            <div key={label}><h3 className="text-sm font-medium text-foreground/75">{label}</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{value}</p></div>
          ) : null)}
          {review.resolution ? <section aria-label="Saved issue resolution" className="rounded-xl border border-success/30 bg-success/5 p-3">
            <h3 className="text-sm font-medium text-success">Resolved in HQ</h3>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-foreground">{review.resolution.note}</p>
            <p className="mt-2 text-xs text-muted">{review.resolution.resolvedBy} · {new Date(review.resolution.resolvedAt).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })} Pacific</p>
          </section> : hasUnresolvedFieldIssue(review.followUpNeeded, review.scopeException, false) ? <form
            onSubmit={event => { event.preventDefault(); void resolve(); }} className="space-y-2 rounded-xl border border-border p-3">
            <label htmlFor={noteId} className="block text-sm font-medium">What resolved the issue?</label>
            <textarea id={noteId} value={note} onChange={event => setNote(event.target.value)} required minLength={3} maxLength={1200} disabled={saving}
              rows={3} className="w-full rounded-lg border border-border bg-background p-3 text-base text-foreground" />
            <p className="text-xs leading-relaxed text-muted">Adds a private HQ note. Original evidence stays unchanged. This does not complete the Jobber job, contact the customer or charge anyone.</p>
            <button type="submit" disabled={saving || note.trim().length < 3} className="min-h-11 rounded-full bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
              {saving ? "Saving resolution…" : "Save resolution"}
            </button>
          </form> : null}
          <p className="text-xs text-muted">Private HQ evidence. Saving this record does not publish it to a customer portal.</p>
          {review.photos.length ? <div className="grid grid-cols-2 gap-3">
            {review.photos.map((photo, index) => <div key={photo.id}>
              {photo.url ? <a href={photo.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-border p-2 text-sm text-accent">
                {photo.mimeType === "image/heic" || photo.mimeType === "image/heif" ? <span className="flex min-h-24 items-center justify-center">Open original photo</span> : <Image unoptimized src={photo.url} alt={`${photo.captureType} photo ${index + 1}`} width={480} height={360} className="aspect-[4/3] w-full rounded-lg object-cover" />}
                <span className="mt-2 block capitalize">{photo.captureType} · Photo {index + 1}</span>
              </a> : <StatusNotice tone="warning">Photo {index + 1} could not be opened.</StatusNotice>}
            </div>)}
          </div> : <p className="text-sm text-muted">No photos were submitted.</p>}
        </> : null}
        <button type="button" onClick={() => void load()} disabled={loading || saving} className="min-h-11 text-sm text-accent underline underline-offset-4 disabled:opacity-50">Refresh evidence and photo links</button>
      </div> : null}
    </section>
  );
}
