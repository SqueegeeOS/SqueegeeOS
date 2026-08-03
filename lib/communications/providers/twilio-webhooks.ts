import twilio from "twilio";
import { normalizeE164, normalizeSmsBody } from "./contracts";

export type SmsConsentKeyword = "stop" | "start" | "none";

export interface TwilioInboundMessage {
  messageSid: string;
  from: string;
  to: string;
  body: string;
  consentKeyword: SmsConsentKeyword;
}

type TwilioFormRecord = Readonly<
  Record<string, string | string[] | null | undefined>
>;

export type TwilioFormInput = URLSearchParams | FormData | TwilioFormRecord;

const STOP_KEYWORDS = new Set([
  "STOP",
  "STOPALL",
  "UNSUBSCRIBE",
  "CANCEL",
  "END",
  "QUIT",
  "REVOKE",
  "OPTOUT",
]);

const START_KEYWORDS = new Set(["START", "UNSTOP", "YES"]);

function readFormValue(input: TwilioFormInput, key: string): string | null {
  if (input instanceof URLSearchParams) return input.get(key);
  if (typeof FormData !== "undefined" && input instanceof FormData) {
    const value = input.get(key);
    return typeof value === "string" ? value : null;
  }

  const value = (input as TwilioFormRecord)[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" ? value : null;
}

export function classifySmsConsentKeyword(body: string): SmsConsentKeyword {
  const normalized = body
    .trim()
    .toUpperCase()
    .replace(/[.!?,;:]+$/g, "")
    .replace(/\s+/g, " ");
  if (STOP_KEYWORDS.has(normalized)) return "stop";
  if (START_KEYWORDS.has(normalized)) return "start";

  // Do not require customers to remember a machine-perfect keyword. Clear,
  // ordinary-language revocations must stop Atlas sends too. These patterns
  // are intentionally specific so messages such as "don't stop by today" do
  // not accidentally change consent.
  if (
    /\b(?:PLEASE\s+)?(?:STOP|QUIT|END|CANCEL)\s+(?:TEXT(?:ING|S)?|MESSAG(?:E|ES|ING)|SMS|CONTACT(?:ING)?|SENDING)\b/.test(
      normalized,
    ) ||
    /^(?:PLEASE\s+)?(?:DO NOT|DON'T|DONT)\s+(?:TEXT|MESSAGE|CONTACT)(?:\s+(?:ME|US|THIS NUMBER|AGAIN|ANYMORE))?(?:\s+PLEASE)?$/.test(
      normalized,
    ) ||
    /\b(?:DO NOT|DON'T|DONT)\s+SEND\s+(?:ME\s+)?(?:TEXTS?|MESSAGES?|SMS)\b/.test(
      normalized,
    ) ||
    /\b(?:REMOVE|TAKE)\s+ME\s+(?:OFF|FROM)\b/.test(normalized) ||
    /\bNO\s+MORE\s+(?:TEXTS?|MESSAGES?|SMS)\b/.test(normalized) ||
    /\bUNSUBSCRIBE\s+ME\b/.test(normalized)
  ) {
    return "stop";
  }
  return "none";
}

export function twilioFormToParams(input: TwilioFormInput): Record<string, string> {
  const params: Record<string, string> = {};

  if (input instanceof URLSearchParams) {
    for (const [key, value] of input.entries()) params[key] = value;
    return params;
  }

  if (typeof FormData !== "undefined" && input instanceof FormData) {
    for (const [key, value] of input.entries()) {
      if (typeof value === "string") params[key] = value;
    }
    return params;
  }

  for (const [key, value] of Object.entries(input as TwilioFormRecord)) {
    if (typeof value === "string") params[key] = value;
    else if (Array.isArray(value) && typeof value[0] === "string") {
      params[key] = value[0];
    }
  }
  return params;
}

/**
 * `url` must be the exact public URL Twilio requested, including its original
 * query string. `params` must include every received form field, not only the
 * fields this application currently recognizes.
 */
export function verifyTwilioWebhookSignature(input: {
  authToken: string | null | undefined;
  signature: string | null | undefined;
  url: string | null | undefined;
  params: Record<string, string>;
}): boolean {
  const authToken = input.authToken?.trim() ?? "";
  const signature = input.signature?.trim() ?? "";
  const url = input.url?.trim() ?? "";
  if (!authToken || !signature || !url) return false;

  try {
    return twilio.validateRequest(authToken, signature, url, input.params);
  } catch {
    return false;
  }
}

export function parseTwilioInboundForm(
  input: TwilioFormInput,
): TwilioInboundMessage | null {
  const messageSid = readFormValue(input, "MessageSid")?.trim() ?? "";
  const from = normalizeE164(readFormValue(input, "From"));
  const to = normalizeE164(readFormValue(input, "To"));
  const body = normalizeSmsBody(readFormValue(input, "Body"));

  if (!/^(?:SM|MM)[0-9a-fA-F]{32}$/.test(messageSid) || !from || !to || !body) {
    return null;
  }

  const providerClassification = readFormValue(input, "OptOutType")
    ?.trim()
    .toUpperCase();
  const consentKeyword =
    providerClassification === "STOP"
      ? "stop"
      : providerClassification === "START"
        ? "start"
        : classifySmsConsentKeyword(body);

  return { messageSid, from, to, body, consentKeyword };
}
