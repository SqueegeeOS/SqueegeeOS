export const PAYMENT_HANDOFF_PROGRESS_STATES = [
  "not_started",
  "preparing",
  "email_sent",
  "expired",
  "delivery_failed",
  "stalled",
  "review_required",
  "completed",
] as const;

export type PaymentHandoffProgressState =
  (typeof PAYMENT_HANDOFF_PROGRESS_STATES)[number];

export interface PaymentHandoffProgressSource {
  status: string;
  emailSentAt: string | null;
  expiresAt: string | null;
  completedAt: string | null;
  lastErrorCode: string | null;
  updatedAt: string | null;
}

export interface PaymentHandoffProgress {
  state: PaymentHandoffProgressState;
  canSend: boolean;
  emailSentAt: string | null;
  expiresAt: string | null;
}

const PREPARING_GRACE_MS = 5 * 60 * 1_000;
const ACTIVE_LINK_BUFFER_MS = 60 * 1_000;

function timestamp(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function progress(
  state: PaymentHandoffProgressState,
  canSend: boolean,
  source: PaymentHandoffProgressSource | null,
): PaymentHandoffProgress {
  return {
    state,
    canSend,
    emailSentAt: source?.emailSentAt ?? null,
    expiresAt: source?.expiresAt ?? null,
  };
}

/**
 * Converts private Stripe/email ledger evidence into the small, URL-free state
 * that owner and field dashboards may safely render.
 */
export function resolvePaymentHandoffProgress(
  source: PaymentHandoffProgressSource | null | undefined,
  reference = new Date(),
): PaymentHandoffProgress {
  if (!source) return progress("not_started", true, null);

  if (source.status === "completed") {
    return progress("completed", false, source);
  }

  if (source.status === "email_sent") {
    const expiresAt = timestamp(source.expiresAt);
    if (expiresAt === null) {
      return progress("review_required", false, source);
    }
    if (
      expiresAt > reference.getTime() + ACTIVE_LINK_BUFFER_MS
    ) {
      return progress("email_sent", false, source);
    }
    return progress("expired", true, source);
  }

  if (source.status === "expired") {
    return progress("expired", true, source);
  }

  if (source.status === "needs_attention") {
    return source.lastErrorCode === "payment_setup_email_failed"
      ? progress("delivery_failed", true, source)
      : progress("review_required", false, source);
  }

  if (source.status === "reserved" || source.status === "session_ready") {
    const updatedAt = timestamp(source.updatedAt);
    if (updatedAt === null) {
      return progress("review_required", false, source);
    }
    if (
      reference.getTime() - updatedAt <= PREPARING_GRACE_MS
    ) {
      return progress("preparing", false, source);
    }
    return progress("stalled", true, source);
  }

  return progress("review_required", false, source);
}

export function paymentHandoffSendLabel(
  state: PaymentHandoffProgressState,
): string {
  switch (state) {
    case "expired":
      return "Reissue secure Stripe link";
    case "delivery_failed":
      return "Retry secure Stripe email";
    case "stalled":
      return "Resume secure Stripe handoff";
    default:
      return "Email secure Stripe link";
  }
}
