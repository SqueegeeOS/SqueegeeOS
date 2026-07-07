"use client";

import { useState } from "react";
import { saveCardOnFile } from "@/lib/membership/card-on-file";
import { STRIPE_CHECKOUT_ENABLED } from "@/lib/membership/types";

const ONBOARDING_PAYMENT_POINTS = [
  {
    title: "Card on file",
    description:
      "Your payment method is stored securely — you won't need to enter it again.",
  },
  {
    title: "Bill after service",
    description:
      "You're charged automatically after each completed membership visit.",
  },
  {
    title: "No checkout at the door",
    description:
      "Your technician focuses on your home, not collecting payment.",
  },
] as const;

export function CardOnFileSetup({
  memberName,
  memberEmail,
  presentationId,
  theme = "presentation",
  onSuccess,
  onBack,
}: {
  memberName: string;
  memberEmail?: string | null;
  presentationId?: string;
  theme?: "presentation" | "portal";
  onSuccess: () => void;
  onBack?: () => void;
}) {
  const [cardholderName, setCardholderName] = useState(memberName);
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPresentation = theme === "presentation";
  const inputClass = isPresentation
    ? "w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-[#f5f2eb] placeholder:text-white/25 outline-none focus:border-accent/40"
    : "w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none focus:border-accent/40";
  const labelClass = isPresentation
    ? "mb-1.5 block text-[10px] uppercase tracking-[0.14em] text-white/40"
    : "mb-1.5 block text-[10px] uppercase tracking-[0.14em] text-muted";
  const pointCardClass = isPresentation
    ? "rounded-lg border border-white/10 bg-white/[0.03] p-4"
    : "rounded-2xl border border-border bg-surface/50 p-4";
  const pointTitleClass = isPresentation
    ? "text-sm font-medium text-[#f5f2eb]"
    : "text-sm font-medium text-foreground";
  const pointBodyClass = isPresentation
    ? "mt-1 text-sm text-white/45"
    : "mt-1 text-sm text-muted";

  const handleSubmit = async () => {
    if (!cardholderName.trim() || cardNumber.replace(/\s/g, "").length < 4) {
      setError("Enter the cardholder name and card number to continue.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await saveCardOnFile({
        memberName: cardholderName.trim(),
        memberEmail,
        presentationId,
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
      <div className="space-y-3">
        {ONBOARDING_PAYMENT_POINTS.map((item) => (
          <div key={item.title} className={pointCardClass}>
            <p className={pointTitleClass}>{item.title}</p>
            <p className={pointBodyClass}>{item.description}</p>
          </div>
        ))}
      </div>

      {STRIPE_CHECKOUT_ENABLED ? (
        <p className={pointBodyClass}>
          You&apos;ll complete card entry on Stripe&apos;s secure page.
        </p>
      ) : (
        <div className="space-y-4 rounded-lg border border-white/10 bg-white/[0.02] p-5">
          <p
            className={
              isPresentation
                ? "text-[10px] uppercase tracking-[0.16em] text-white/35"
                : "text-[10px] uppercase tracking-[0.16em] text-muted"
            }
          >
            Payment method
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
          <div>
            <label className={labelClass} htmlFor="card-number">
              Card number
            </label>
            <input
              id="card-number"
              className={inputClass}
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              placeholder="4242 4242 4242 4242"
              inputMode="numeric"
              autoComplete="cc-number"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="card-expiry">
                Expiry
              </label>
              <input
                id="card-expiry"
                className={inputClass}
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                placeholder="MM / YY"
                autoComplete="cc-exp"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="card-cvc">
                CVC
              </label>
              <input
                id="card-cvc"
                className={inputClass}
                value={cvc}
                onChange={(e) => setCvc(e.target.value)}
                placeholder="123"
                inputMode="numeric"
                autoComplete="cc-csc"
              />
            </div>
          </div>
          {!STRIPE_CHECKOUT_ENABLED ? (
            <p className="text-xs text-white/30">
              Demo mode — card is not charged. Stripe connects in production.
            </p>
          ) : null}
        </div>
      )}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            disabled={loading}
            className={
              isPresentation
                ? "rounded-lg border border-white/15 px-5 py-3.5 text-sm text-white/60 transition hover:border-white/30 hover:text-white/80 disabled:opacity-40"
                : "rounded-full border border-border px-5 py-3.5 text-sm text-muted"
            }
          >
            Back
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleSubmit}
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
    </div>
  );
}
