"use client";

import Image from "next/image";
import { useState } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { StatusNotice } from "@/components/craft/status-notice";
import type { FieldCloseoutReview as Review } from "@/lib/field-records/field-closeout-review";

export function FieldCloseoutReview({ assignmentId }: { assignmentId: string }) {
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

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
      <button type="button" disabled={loading} aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left text-sm font-medium text-accent disabled:opacity-50"
        onClick={() => open ? setOpen(false) : void load()}>
        {loading ? "Opening visit evidence…" : "Review technician notes + photos"}
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open ? <div className="mt-3 space-y-4">
        {error ? <StatusNotice tone="danger">{error}</StatusNotice> : null}
        {review ? <>
          <p className="text-sm text-foreground/65">{review.technicianName} · Visit {review.visitDate}</p>
          {review.followUpNeeded ? <StatusNotice tone="warning">This visit needs owner follow-up.</StatusNotice> : null}
          {([ ["Work summary", review.customerSummary], ["Internal notes", review.internalNote], ["Service exceptions", review.scopeException] ] as const).map(([label, value]) => value ? (
            <div key={label}><h3 className="text-sm font-medium text-foreground/75">{label}</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{value}</p></div>
          ) : null)}
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
        <button type="button" onClick={() => void load()} disabled={loading} className="min-h-11 text-sm text-accent underline underline-offset-4 disabled:opacity-50">Refresh evidence and photo links</button>
      </div> : null}
    </section>
  );
}
