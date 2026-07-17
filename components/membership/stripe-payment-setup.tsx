"use client";

import { useMemo, useEffect, useState } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe, type StripeElementsOptions } from "@stripe/stripe-js";
import { getStripePublishableKey } from "@/lib/stripe/client";

interface StripePaymentSetupProps {
  memberName: string;
  memberEmail?: string | null;
  presentationId?: string;
  membershipId?: string;
  theme?: "presentation" | "portal";
  onSuccess: () => void;
  onBack?: () => void;
}

function StripePaymentForm({
  theme,
  memberName,
  memberEmail,
  onSuccess,
  onBack,
  presentationId,
  membershipId,
}: {
  theme: "presentation" | "portal";
  memberName: string;
  memberEmail?: string | null;
  onSuccess: () => void;
  onBack?: () => void;
  presentationId?: string;
  membershipId?: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPresentation = theme === "presentation";
  const pointBodyClass = isPresentation
    ? "text-sm text-muted"
    : "text-sm text-muted";

  const handleSubmit = async () => {
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    try {
      const { error: submitError, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
      });

      if (submitError) {
        throw new Error(submitError.message ?? "Card setup failed");
      }

      if (!setupIntent || setupIntent.status !== "succeeded") {
        throw new Error("Card setup was not completed. Please try again.");
      }

      const paymentMethodId =
        typeof setupIntent.payment_method === "string"
          ? setupIntent.payment_method
          : setupIntent.payment_method?.id;

      if (!paymentMethodId) {
        throw new Error("No payment method returned from Stripe");
      }

      const response = await fetch("/api/membership/setup-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presentationId,
          membershipId,
          paymentMethodId,
          setupIntentId: setupIntent.id,
        }),
      });

      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Unable to activate membership");
      }

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
    <div className="space-y-4">
      <PaymentElement
        options={{
          layout: "tabs",
          defaultValues: {
            billingDetails: {
              name: memberName,
              email: memberEmail ?? undefined,
            },
          },
          wallets:
            theme === "presentation"
              ? {
                  applePay: "never",
                  googlePay: "never",
                  link: "never",
                }
              : undefined,
        }}
      />
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <p className={`text-xs ${pointBodyClass}`}>
        Secured by Stripe. Card details never touch our servers.
      </p>
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
          onClick={() => void handleSubmit()}
          disabled={loading || !stripe || !elements}
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

export function StripePaymentSetup(props: StripePaymentSetupProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const publishableKey = getStripePublishableKey();
  const stripePromise = useMemo(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey],
  );

  useEffect(() => {
    let cancelled = false;

    // Do not display a previous customer's Stripe form while the next
    // presentation requests a fresh SetupIntent.
    setClientSecret(null);
    setLoadError(null);

    async function loadIntent() {
      try {
        const response = await fetch("/api/stripe/setup-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            presentationId: props.presentationId,
            membershipId: props.membershipId,
            memberName: props.memberName,
            memberEmail: props.memberEmail,
          }),
        });

        const body = (await response.json().catch(() => null)) as {
          clientSecret?: string;
          error?: string;
        } | null;

        if (!response.ok || !body?.clientSecret) {
          throw new Error(body?.error ?? "Unable to start secure card setup");
        }

        if (!cancelled) {
          setClientSecret(body.clientSecret);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error
              ? err.message
              : "Unable to load payment form.",
          );
        }
      }
    }

    void loadIntent();
    return () => {
      cancelled = true;
    };
  }, [
    props.memberEmail,
    props.memberName,
    props.membershipId,
    props.presentationId,
  ]);

  if (!publishableKey) {
    return (
      <p className="text-sm text-red-400">
        Stripe publishable key is not configured.
      </p>
    );
  }

  if (loadError) {
    return <p className="text-sm text-red-400">{loadError}</p>;
  }

  if (!clientSecret || !stripePromise) {
    return (
      <p className="text-sm text-muted">Loading secure payment form…</p>
    );
  }

  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: props.theme === "presentation" ? "night" : "stripe",
      variables: {
        colorPrimary: "#c5a869",
      },
    },
  };

  return (
    <Elements key={clientSecret} stripe={stripePromise} options={options}>
      <StripePaymentForm
        theme={props.theme ?? "presentation"}
        memberName={props.memberName}
        memberEmail={props.memberEmail}
        onSuccess={props.onSuccess}
        onBack={props.onBack}
        presentationId={props.presentationId}
        membershipId={props.membershipId}
      />
    </Elements>
  );
}
