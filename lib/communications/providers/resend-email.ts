import {
  errorCodeForProviderHttpStatus,
  getProviderConfigState,
  MAX_EMAIL_HTML_LENGTH,
  MAX_EMAIL_SUBJECT_LENGTH,
  MAX_EMAIL_TEXT_LENGTH,
  normalizeEmailDestination,
  normalizeEmailMailbox,
  normalizeIdempotencyKey,
  providerFailure,
  providerSuccess,
  type ProviderConfigState,
  type ProviderSendResult,
} from "./contracts";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";

export interface ResendEmailConfig {
  apiKey: string;
  from: string;
}

export interface SendResendEmailInput {
  to: string;
  subject: string;
  replyTo: string;
  idempotencyKey: string;
  html?: string;
  text?: string;
}

interface ResendEmailOptions {
  config?: Partial<ResendEmailConfig>;
  fetch?: typeof fetch;
}

export function resolveResendEmailConfig(
  overrides: Partial<ResendEmailConfig> = {},
): ResendEmailConfig {
  return {
    apiKey: overrides.apiKey?.trim() || process.env.RESEND_API_KEY?.trim() || "",
    from:
      overrides.from?.trim() ||
      process.env.RESEND_COMMUNICATIONS_FROM?.trim() ||
      process.env.RESEND_AGREEMENT_FROM?.trim() ||
      "",
  };
}

export function getResendEmailConfigState(
  config: ResendEmailConfig = resolveResendEmailConfig(),
): ProviderConfigState {
  return getProviderConfigState({
    RESEND_API_KEY: config.apiKey,
    RESEND_COMMUNICATIONS_FROM: normalizeEmailMailbox(config.from),
  });
}

function normalizeSubject(value: string): string | null {
  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > MAX_EMAIL_SUBJECT_LENGTH ||
    /[\r\n]/.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

function normalizeContent(value: string | undefined, maxLength: number): string | null {
  const normalized = value?.trim() ?? "";
  return normalized && normalized.length <= maxLength ? normalized : null;
}

export async function sendResendEmail(
  input: SendResendEmailInput,
  options: ResendEmailOptions = {},
): Promise<ProviderSendResult> {
  const config = resolveResendEmailConfig(options.config);
  if (!getResendEmailConfigState(config).configured) {
    return providerFailure({
      provider: "resend",
      channel: "email",
      errorCode: "not_configured",
    });
  }

  const to = normalizeEmailDestination(input.to);
  if (!to) {
    return providerFailure({
      provider: "resend",
      channel: "email",
      errorCode: "invalid_destination",
    });
  }

  const from = normalizeEmailMailbox(config.from);
  if (!from) {
    return providerFailure({
      provider: "resend",
      channel: "email",
      errorCode: "invalid_sender",
    });
  }

  const replyTo = normalizeEmailDestination(input.replyTo);
  if (!replyTo) {
    return providerFailure({
      provider: "resend",
      channel: "email",
      errorCode: "invalid_reply_to",
    });
  }

  const subject = normalizeSubject(input.subject);
  if (!subject) {
    return providerFailure({
      provider: "resend",
      channel: "email",
      errorCode: "invalid_subject",
    });
  }

  const html = normalizeContent(input.html, MAX_EMAIL_HTML_LENGTH);
  const text = normalizeContent(input.text, MAX_EMAIL_TEXT_LENGTH);
  if (!html && !text) {
    return providerFailure({
      provider: "resend",
      channel: "email",
      errorCode: "invalid_body",
    });
  }

  const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
  if (!idempotencyKey) {
    return providerFailure({
      provider: "resend",
      channel: "email",
      errorCode: "invalid_idempotency_key",
    });
  }

  const payload = {
    from,
    to: [to],
    reply_to: replyTo,
    subject,
    ...(html ? { html } : {}),
    ...(text ? { text } : {}),
  };

  let response: Response;
  try {
    response = await (options.fetch ?? fetch)(RESEND_EMAILS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return providerFailure({
      provider: "resend",
      channel: "email",
      errorCode: "network_error",
    });
  }

  if (!response.ok) {
    return providerFailure({
      provider: "resend",
      channel: "email",
      errorCode: errorCodeForProviderHttpStatus(response.status),
      httpStatus: response.status,
    });
  }

  const body = (await response.json().catch(() => null)) as { id?: unknown } | null;
  const providerMessageId =
    typeof body?.id === "string" && body.id.trim() ? body.id.trim() : null;
  if (!providerMessageId) {
    return providerFailure({
      provider: "resend",
      channel: "email",
      errorCode: "invalid_response",
      httpStatus: response.status,
    });
  }

  return providerSuccess({
    provider: "resend",
    channel: "email",
    providerMessageId,
    status: "accepted",
  });
}
