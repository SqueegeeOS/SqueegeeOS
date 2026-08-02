export interface ManualSendAttempt {
  fingerprint: string;
  idempotencyKey: string;
}

export function manualSendFingerprint(input: {
  conversationId: string;
  channel: "email" | "sms";
  subject?: string | null;
  body: string;
}): string {
  return JSON.stringify([
    input.conversationId.trim(),
    input.channel,
    input.channel === "email" ? input.subject?.trim() ?? "" : "",
    input.body.trim(),
  ]);
}

/** Reuses the same key only while retrying the exact same composed message. */
export function resolveManualSendAttempt(
  current: ManualSendAttempt | null,
  fingerprint: string,
  createId: () => string = () => globalThis.crypto.randomUUID(),
): ManualSendAttempt {
  if (current?.fingerprint === fingerprint) return current;
  return {
    fingerprint,
    idempotencyKey: `hq-manual:${createId()}`,
  };
}
