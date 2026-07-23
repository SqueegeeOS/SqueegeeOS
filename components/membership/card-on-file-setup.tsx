"use client";

import { StripePaymentSetup } from "@/components/membership/stripe-payment-setup";
import {
  MEMBERSHIP_BILLING_PHILOSOPHY,
  MEMBERSHIP_BILLING_REMINDER,
  MEMBERSHIP_ONBOARDING_PAYMENT_POINTS,
} from "@/lib/agreement/agreement-content";
import { STRIPE_CHECKOUT_ENABLED } from "@/lib/stripe/client";

export function CardOnFileSetup({
  presentationId,
  portalToken,
  theme = "presentation",
  onSuccess,
  onBack,
}: {
  presentationId?: string;
  portalToken?: string | null;
  theme?: "presentation" | "portal";
  onSuccess: () => void;
  onBack?: () => void;
}) {
  const isPresentation = theme === "presentation";
  const pointCardClass = isPresentation
    ? "rounded-lg border border-border bg-foreground/[0.03] p-4"
    : "rounded-2xl border border-border bg-surface/50 p-4";
  const pointBodyClass = isPresentation
    ? "mt-1 text-sm text-foreground/50 portal-payment-copy"
    : "mt-1 text-sm text-muted";

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
            <p className="text-sm font-medium text-foreground">{item.title}</p>
            <p className={pointBodyClass}>{item.description}</p>
          </div>
        ))}
      </div>

      {STRIPE_CHECKOUT_ENABLED ? (
        <StripePaymentSetup
          presentationId={presentationId}
          portalToken={portalToken}
          theme={theme}
          onBack={onBack}
          onSuccess={onSuccess}
        />
      ) : (
        <p className="rounded-lg border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">
          Secure card setup is unavailable. Your membership has not been
          activated.
        </p>
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
    </div>
  );
}
