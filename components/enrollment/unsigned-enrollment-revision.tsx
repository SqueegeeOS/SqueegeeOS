"use client";

import { useRef, useState } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import type { EnrollmentPacketStatusSnapshot } from "@/lib/enrollment/types";

export function UnsignedEnrollmentRevision({ presentationId, packet, onSent }: {
  presentationId: string;
  packet: EnrollmentPacketStatusSnapshot;
  onSent: () => void;
}) {
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitLock = useRef(false);
  const revision = packet.unsignedRevision;
  if (!revision) return null;

  const revise = async () => {
    if (submitLock.current || !confirmed || !reason.trim()) return;
    // Remains locked on ambiguous failures. Never automatically send again.
    submitLock.current = true;
    setAttempted(true);
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/enrollment-packets", {
        method: "POST",
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({
          ...revision,
          action: "revise_unsigned_native",
          presentationId,
          paymentRail: packet.paymentRail,
          revisionId: crypto.randomUUID(),
          revisionReason: reason.trim(),
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "Revision delivery could not be verified.");
      onSent();
    } catch (cause) {
      setError(`${cause instanceof Error ? cause.message : "Revision delivery could not be verified."} Check Enrollment Desk and delivery history before trying again.`);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="mt-5 rounded-xl border border-amber-300/25 bg-black/15 p-4" aria-label="Revise unsigned agreement">
      <h4 className="text-sm font-semibold text-white">Revise and resend unsigned agreement</h4>
      <p className="mt-2 text-xs leading-relaxed text-white/65">
        Send the current saved {revision.tier} plan to {revision.recipientEmail}: ${revision.firstVisitPrice.toFixed(2)} first visit,
        ${revision.recurringVisitPrice.toFixed(2)} continuing visits, ${revision.annualizedValue.toFixed(2)} annually.
        The existing payment arrangement and signer are preserved. Unsaved edits are not included.
      </p>
      <label className="mt-3 block text-xs text-white/65">
        Reason for revision
        <textarea aria-label="Reason for revision" value={reason} maxLength={1000} disabled={attempted}
          onChange={(event) => setReason(event.target.value)}
          className="mt-2 block min-h-20 w-full rounded-lg border border-white/20 bg-black/25 p-3 text-white" />
      </label>
      <label className="mt-3 flex gap-2 text-xs leading-relaxed text-white/70">
        <input type="checkbox" checked={confirmed} disabled={attempted}
          onChange={(event) => setConfirmed(event.target.checked)} />
        I reviewed the saved plan and recipient. Invalidate all old enrollment links and email this corrected agreement once.
      </label>
      <button type="button" onClick={revise} disabled={!confirmed || !reason.trim() || attempted}
        className="mt-4 min-h-12 w-full rounded-lg bg-white px-4 text-sm font-semibold text-black disabled:opacity-35">
        {sending ? "Revising and sending…" : attempted ? "Revision attempted · check delivery" : "Revise and resend unsigned agreement"}
      </button>
      {error ? <p role="alert" className="mt-3 text-xs text-amber-100">{error}</p> : null}
    </section>
  );
}
