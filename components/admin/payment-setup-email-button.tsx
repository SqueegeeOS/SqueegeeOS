"use client";

import { useState } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";

export function PaymentSetupEmailButton({
  membershipId,
  canSend,
  onAccepted,
}: {
  membershipId: string | null;
  canSend: boolean;
  onAccepted?: (message: string) => void;
}) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!membershipId || !canSend || sending) return;
    setSending(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/memberships/${encodeURIComponent(membershipId)}/send-payment-link`,
        {
          method: "POST",
          headers: getAdminRequestHeaders(),
        },
      );
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Secure Stripe email could not be sent.");
      }
      onAccepted?.(
        body?.message ?? "Secure Stripe email accepted for delivery.",
      );
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Secure Stripe email could not be sent.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => void send()}
        disabled={!membershipId || !canSend || sending}
        className="inline-flex min-h-9 items-center rounded-full border border-accent/35 bg-accent/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-accent transition hover:border-accent/60 hover:bg-accent/15 disabled:pointer-events-none disabled:opacity-40"
      >
        {sending ? "Sending Stripe link…" : "Email Stripe setup"}
      </button>
      {error ? (
        <p className="mt-2 max-w-xs text-xs text-red-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
