"use client";

import { useEffect, useState } from "react";
import { saveCardOnFile } from "@/lib/membership/card-on-file";
import { StripePaymentSetup } from "@/components/membership/stripe-payment-setup";
import {
  MEMBERSHIP_BILLING_PHILOSOPHY,
  MEMBERSHIP_BILLING_REMINDER,
  MEMBERSHIP_ONBOARDING_PAYMENT_POINTS,
} from "@/lib/agreement/agreement-content";
import { STRIPE_CHECKOUT_ENABLED } from "@/lib/stripe/client";

export function CardOnFileSetup({
  memberName,
  memberEmail,
  presentationId,
  membershipId,
  theme = "presentation",
  onSuccess,
  onBack,
}: {
  memberName: string;
  memberEmail?: string | null;
  presentationId?: string;
  membershipId?: string;
  theme?: "presentation" | "portal";
  onSuccess: () => void;
  onBack?: () => void;
}) {
  const [cardholderName, setCardholderName] = useState(memberName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCardholderName(memberName);
    setError(null);
  }, [memberName, memberEmail, membershipId, presentationId]);

  const isPresentation = theme === "presentation";
  const inputClass = isPresentation
    ? "w-full rounded-lg border border-border bg-foreground/5 px-4 py-3 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent/40"
    : "w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none focus:border-accent/40";
  const labelClass = isPresentation
    ? "mb-1.5 block text-[10px] uppercase tracking-[0.14em] text-muted"
    : "mb-1.5 block text-[10px] uppercase tracking-[0.14em] text-muted";
  const pointCardClass = isPresentation
    ? "rounded-lg border border-border bg-foreground/[0.03] p-4"
    : "rounded-2xl border border-border bg-surface/50 p-4";
  const pointTitleClass = isPresentation
    ? "text-sm font-medium text-foreground"
    : "text-sm font-medium text-foreground";
  const pointBodyClass = isPresentation
    ? "mt-1 text-sm text-muted"
    : "mt-1 text-sm text-muted";

  const handleMockSubmit = async () => {
    if (!cardholderName.trim()) {
      setError("Enter the cardholder name to continue.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await saveCardOnFile({
        memberName: cardholderName.trim(),
        memberEmail,
        presentationId,
        membershipId,
      });
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save payment method.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <p
        className={
          isPresentation
            ? "font-serif text-sm italic leading-relaxed text-accent/75"
            : "font-serif text-sm italic leading-relaxed text-accent/90"
        }
      >
        {MEMBERSHIP_BILLING_PHILOSOPHY}
      </p>

      <div className="space-y-3">
        {MEMBERSHIP_ONBOARDING_PAYMENT_POINTS.map((item) => (
          <div key={item.title} className={pointCardClass}>
            <p className={pointTitleClass}>{item.title}</p>
            <p className={pointBodyClass}>{item.description}</p>
          </div>
        ))}
      </div>

      {STRIPE_CHECKOUT_ENABLED ? (
        <StripePaymentSetup
          memberName={cardholderName.trim() || memberName}
          memberEmail={memberEmail}
          presentationId={presentationId}
          membershipId={membershipId}
          theme={theme}
          onBack={onBack}
          onSuccess={onSuccess}
        />
      ) : (
        <div className="space-y-4 rounded-lg border border-border bg-foreground/[0.02] p-5">
          <p
            className={
              isPresentation
                ? "text-[10px] uppercase tracking-[0.16em] text-muted"
                : "text-[10px] uppercase tracking-[0.16em] text-muted"
            }
          >
            Payment method (demo)
          </p>
          <div>
            <label className={labelClass} htmlFor="cardholder-name">
              Name on card
            </label>
            <input
              id="cardholder-name"
              className={inputClass}
              value={cardholderName}
              onChange={(e) => setCardholderName(e.target.value)}
              autoComplete="cc-name"
            />
          </div>
          <p className="text-xs text-muted">
            Demo mode — confirms membership without charging. Add Stripe keys in
            Vercel for live card-on-file.
          </p>
        </div>
      )}

      <div
        className={
          isPresentation
            ? "rounded-lg border border-accent/15 bg-accent/[0.04] p-4"
            : "rounded-2xl border border-accent/20 bg-accent/5 p-4"
        }
      >
        <p
          className={
            isPresentation
              ? "text-[10px] uppercase tracking-[0.14em] text-accent/70"
              : "text-[10px] uppercase tracking-[0.14em] text-accent"
          }
        >
          Billing reminder
        </p>
        <p className={`mt-2 text-sm leading-relaxed ${pointBodyClass}`}>
          {MEMBERSHIP_BILLING_REMINDER}
        </p>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {!STRIPE_CHECKOUT_ENABLED ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              disabled={loading}
              className={
                isPresentation
                  ? "rounded-lg border border-border px-5 py-3.5 text-sm text-muted transition hover:border-accent/30 hover:text-foreground disabled:opacity-40"
                  : "rounded-full border border-border px-5 py-3.5 text-sm text-muted"
              }
            >
              Back
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void handleMockSubmit()}
            disabled={loading}
            className={
              isPresentation
                ? "flex-1 rounded-lg bg-gradient-to-br from-accent to-[#e8d5a3] py-3.5 text-sm font-bold text-[#060606] transition disabled:opacity-40"
                : "flex-1 rounded-full bg-accent py-3.5 text-sm font-medium text-background disabled:opacity-40"
            }
          >
            {loading ? "Saving…" : "Save payment method"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
