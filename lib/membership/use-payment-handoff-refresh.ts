"use client";

import { useEffect } from "react";

export const PAYMENT_HANDOFF_REFRESH_INTERVAL_MS = 30_000;

/**
 * Keeps a payment handoff current while Stripe is waiting on the customer.
 * Revalidation is read-only: it never sends a message or creates a charge.
 */
export function usePaymentHandoffRefresh(input: {
  enabled: boolean;
  refresh: () => Promise<void>;
  intervalMs?: number;
}) {
  const {
    enabled,
    refresh,
    intervalMs = PAYMENT_HANDOFF_REFRESH_INTERVAL_MS,
  } = input;

  useEffect(() => {
    if (!enabled) return;

    let refreshInFlight = false;
    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible" || refreshInFlight) return;
      refreshInFlight = true;
      void refresh()
        .catch(() => {
          // The owning screen already renders its safe load error state.
        })
        .finally(() => {
          refreshInFlight = false;
        });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshWhenVisible();
    };

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const interval = window.setInterval(refreshWhenVisible, intervalMs);

    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(interval);
    };
  }, [enabled, intervalMs, refresh]);
}
