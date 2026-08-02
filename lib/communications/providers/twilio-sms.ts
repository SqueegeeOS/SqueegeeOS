import {
  errorCodeForProviderHttpStatus,
  getProviderConfigState,
  normalizeE164,
  normalizeHttpsUrl,
  normalizeProviderDeliveryStatus,
  normalizeSmsBody,
  providerFailure,
  providerSuccess,
  type ProviderConfigState,
  type ProviderDeliveryStatus,
  type ProviderSendResult,
} from "./contracts";

export interface TwilioSmsConfig {
  accountSid: string;
  authToken: string;
  fromNumber?: string;
  messagingServiceSid?: string;
  statusCallbackUrl: string;
}

export interface SendTwilioSmsInput {
  to: string;
  body: string;
}

interface TwilioSmsOptions {
  config?: Partial<TwilioSmsConfig>;
  fetch?: typeof fetch;
}

function normalizeAccountSid(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return /^AC[0-9a-fA-F]{32}$/.test(normalized) ? normalized : null;
}

function normalizeMessagingServiceSid(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim() ?? "";
  return /^MG[0-9a-fA-F]{32}$/.test(normalized) ? normalized : null;
}

export function resolveTwilioSmsConfig(
  overrides: Partial<TwilioSmsConfig> = {},
): TwilioSmsConfig {
  return {
    accountSid:
      overrides.accountSid?.trim() || process.env.TWILIO_ACCOUNT_SID?.trim() || "",
    authToken:
      overrides.authToken?.trim() || process.env.TWILIO_AUTH_TOKEN?.trim() || "",
    fromNumber:
      overrides.fromNumber?.trim() || process.env.TWILIO_FROM_NUMBER?.trim(),
    messagingServiceSid:
      overrides.messagingServiceSid?.trim() ||
      process.env.TWILIO_MESSAGING_SERVICE_SID?.trim(),
    statusCallbackUrl:
      overrides.statusCallbackUrl?.trim() ||
      process.env.TWILIO_STATUS_CALLBACK_URL?.trim() ||
      "",
  };
}

export function getTwilioSmsConfigState(
  config: TwilioSmsConfig = resolveTwilioSmsConfig(),
): ProviderConfigState {
  const sender =
    normalizeMessagingServiceSid(config.messagingServiceSid) ??
    normalizeE164(config.fromNumber);

  return getProviderConfigState({
    TWILIO_ACCOUNT_SID: normalizeAccountSid(config.accountSid),
    TWILIO_AUTH_TOKEN: config.authToken,
    TWILIO_SENDER: sender,
    TWILIO_STATUS_CALLBACK_URL: normalizeHttpsUrl(config.statusCallbackUrl),
  });
}

export function normalizeTwilioMessageStatus(
  value: string | null | undefined,
): ProviderDeliveryStatus {
  return normalizeProviderDeliveryStatus(value);
}

export async function sendTwilioSms(
  input: SendTwilioSmsInput,
  options: TwilioSmsOptions = {},
): Promise<ProviderSendResult> {
  const config = resolveTwilioSmsConfig(options.config);
  if (!getTwilioSmsConfigState(config).configured) {
    return providerFailure({
      provider: "twilio",
      channel: "sms",
      errorCode: "not_configured",
    });
  }

  const accountSid = normalizeAccountSid(config.accountSid)!;
  const to = normalizeE164(input.to);
  if (!to) {
    return providerFailure({
      provider: "twilio",
      channel: "sms",
      errorCode: "invalid_destination",
    });
  }

  const body = normalizeSmsBody(input.body);
  if (!body) {
    return providerFailure({
      provider: "twilio",
      channel: "sms",
      errorCode: "invalid_body",
    });
  }

  const statusCallbackUrl = normalizeHttpsUrl(config.statusCallbackUrl);
  if (!statusCallbackUrl) {
    return providerFailure({
      provider: "twilio",
      channel: "sms",
      errorCode: "invalid_callback_url",
    });
  }

  const form = new URLSearchParams({
    To: to,
    Body: body,
    StatusCallback: statusCallbackUrl,
  });
  const messagingServiceSid = normalizeMessagingServiceSid(
    config.messagingServiceSid,
  );
  if (messagingServiceSid) {
    form.set("MessagingServiceSid", messagingServiceSid);
  } else {
    const from = normalizeE164(config.fromNumber);
    if (!from) {
      return providerFailure({
        provider: "twilio",
        channel: "sms",
        errorCode: "invalid_sender",
      });
    }
    form.set("From", from);
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
  const authorization = Buffer.from(
    `${accountSid}:${config.authToken}`,
    "utf8",
  ).toString("base64");

  let response: Response;
  try {
    response = await (options.fetch ?? fetch)(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authorization}`,
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: form.toString(),
    });
  } catch {
    return providerFailure({
      provider: "twilio",
      channel: "sms",
      errorCode: "network_error",
    });
  }

  if (!response.ok) {
    return providerFailure({
      provider: "twilio",
      channel: "sms",
      errorCode: errorCodeForProviderHttpStatus(response.status),
      httpStatus: response.status,
    });
  }

  const payload = (await response.json().catch(() => null)) as {
    sid?: unknown;
    status?: unknown;
  } | null;
  const providerMessageId =
    typeof payload?.sid === "string" && payload.sid.trim()
      ? payload.sid.trim()
      : null;
  if (!providerMessageId) {
    return providerFailure({
      provider: "twilio",
      channel: "sms",
      errorCode: "invalid_response",
      httpStatus: response.status,
    });
  }

  const rawStatus = typeof payload?.status === "string" ? payload.status : null;
  return providerSuccess({
    provider: "twilio",
    channel: "sms",
    providerMessageId,
    status: normalizeTwilioMessageStatus(rawStatus),
  });
}
