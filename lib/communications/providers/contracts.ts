export type CommunicationProvider = "resend" | "twilio";

export type CommunicationChannel = "email" | "sms";

export type ProviderDeliveryStatus =
  | "accepted"
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "delayed"
  | "opened"
  | "clicked"
  | "receiving"
  | "received"
  | "read"
  | "undelivered"
  | "bounced"
  | "complained"
  | "failed"
  | "canceled"
  | "unknown";

/**
 * Codes are deliberately provider-neutral and safe to persist or return from an
 * API. Provider response bodies can contain credentials or customer data and
 * must not be copied into these results.
 */
export type ProviderErrorCode =
  | "not_configured"
  | "invalid_destination"
  | "invalid_sender"
  | "invalid_reply_to"
  | "invalid_subject"
  | "invalid_body"
  | "invalid_idempotency_key"
  | "invalid_callback_url"
  | "authentication_failed"
  | "rate_limited"
  | "provider_rejected"
  | "provider_unavailable"
  | "network_error"
  | "invalid_response";

export interface ProviderConfigState {
  configured: boolean;
  /** Environment/configuration names only. Values are never returned. */
  missing: string[];
}

interface ProviderSendResultBase {
  provider: CommunicationProvider;
  channel: CommunicationChannel;
  status: ProviderDeliveryStatus;
}

export interface ProviderSendSuccess extends ProviderSendResultBase {
  ok: true;
  providerMessageId: string;
}

export interface ProviderSendFailure extends ProviderSendResultBase {
  ok: false;
  status: "failed";
  errorCode: ProviderErrorCode;
  httpStatus?: number;
}

export type ProviderSendResult = ProviderSendSuccess | ProviderSendFailure;

export const MAX_SMS_BODY_LENGTH = 1_600;
export const MAX_EMAIL_SUBJECT_LENGTH = 200;
export const MAX_EMAIL_TEXT_LENGTH = 100_000;
export const MAX_EMAIL_HTML_LENGTH = 500_000;
export const MAX_PROVIDER_IDEMPOTENCY_KEY_LENGTH = 256;

export function getProviderConfigState(
  required: Readonly<Record<string, string | null | undefined>>,
): ProviderConfigState {
  const missing = Object.entries(required)
    .filter(([, value]) => !value?.trim())
    .map(([name]) => name);

  return { configured: missing.length === 0, missing };
}

export function providerSuccess(input: {
  provider: CommunicationProvider;
  channel: CommunicationChannel;
  providerMessageId: string;
  status: ProviderDeliveryStatus;
}): ProviderSendSuccess {
  return { ok: true, ...input };
}

export function providerFailure(input: {
  provider: CommunicationProvider;
  channel: CommunicationChannel;
  errorCode: ProviderErrorCode;
  httpStatus?: number;
}): ProviderSendFailure {
  return { ok: false, status: "failed", ...input };
}

export function errorCodeForProviderHttpStatus(status: number): ProviderErrorCode {
  if (status === 401 || status === 403) return "authentication_failed";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "provider_unavailable";
  return "provider_rejected";
}

export function normalizeProviderDeliveryStatus(
  value: string | null | undefined,
): ProviderDeliveryStatus {
  const normalized = value?.trim().toLowerCase().replace(/^email[._-]/, "") ?? "";

  switch (normalized) {
    case "accepted":
      return "accepted";
    case "scheduled":
    case "queued":
      return "queued";
    case "sending":
      return "sending";
    case "sent":
      return "sent";
    case "delivered":
      return "delivered";
    case "delivery_delayed":
    case "delayed":
      return "delayed";
    case "opened":
      return "opened";
    case "clicked":
      return "clicked";
    case "receiving":
      return "receiving";
    case "received":
      return "received";
    case "read":
      return "read";
    case "undelivered":
      return "undelivered";
    case "bounced":
      return "bounced";
    case "complained":
      return "complained";
    case "failed":
      return "failed";
    case "canceled":
    case "cancelled":
      return "canceled";
    default:
      return "unknown";
  }
}

/** Accepts international phone numbers only; extensions and channel prefixes are rejected. */
export function normalizeE164(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}

export function normalizeEmailDestination(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized || normalized.length > 254 || /[\r\n<>]/.test(normalized)) {
    return null;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

/** Supports either an address or a Resend-compatible `Name <address>` mailbox. */
export function normalizeEmailMailbox(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim() ?? "";
  if (!normalized || normalized.length > 320 || /[\r\n]/.test(normalized)) {
    return null;
  }

  const bracketed = normalized.match(/<([^<>]+)>$/)?.[1];
  const address = bracketed ?? normalized;
  return normalizeEmailDestination(address) ? normalized : null;
}

export function normalizeIdempotencyKey(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim() ?? "";
  if (
    !normalized ||
    normalized.length > MAX_PROVIDER_IDEMPOTENCY_KEY_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

export function normalizeHttpsUrl(
  value: string | null | undefined,
): string | null {
  try {
    const url = new URL(value?.trim() ?? "");
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeSmsBody(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  if (!normalized || Array.from(normalized).length > MAX_SMS_BODY_LENGTH) {
    return null;
  }
  return normalized;
}
