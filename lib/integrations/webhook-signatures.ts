import { createHmac, timingSafeEqual } from "crypto";

function safeEqual(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyJobberWebhookSignature(input: {
  payload: string;
  signature: string | null;
  secret: string;
}): boolean {
  if (!input.signature || !input.secret) return false;
  let provided: Buffer;
  try {
    provided = Buffer.from(input.signature.trim(), "base64");
  } catch {
    return false;
  }
  if (provided.length === 0) return false;
  const expected = createHmac("sha256", input.secret)
    .update(input.payload, "utf8")
    .digest();
  return safeEqual(expected, provided);
}

export function verifyMetaWebhookSignature(input: {
  payload: string;
  signature: string | null;
  secret: string;
}): boolean {
  if (!input.signature || !input.secret) return false;
  const match = /^sha256=([0-9a-f]{64})$/i.exec(input.signature.trim());
  if (!match) return false;
  const expected = createHmac("sha256", input.secret)
    .update(input.payload, "utf8")
    .digest();
  try {
    return safeEqual(expected, Buffer.from(match[1], "hex"));
  } catch {
    return false;
  }
}

export function verifySvixWebhookSignature(input: {
  payload: string;
  messageId: string | null;
  timestamp: string | null;
  signature: string | null;
  secret: string;
  nowSeconds?: number;
  toleranceSeconds?: number;
}): boolean {
  if (
    !input.messageId ||
    !input.timestamp ||
    !input.signature ||
    !input.secret
  ) {
    return false;
  }
  const timestamp = Number.parseInt(input.timestamp, 10);
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const toleranceSeconds = input.toleranceSeconds ?? 5 * 60;
  if (
    !Number.isFinite(timestamp) ||
    Math.abs(nowSeconds - timestamp) > toleranceSeconds
  ) {
    return false;
  }

  const encodedSecret = input.secret.startsWith("whsec_")
    ? input.secret.slice("whsec_".length)
    : input.secret;
  let secret: Buffer;
  try {
    secret = Buffer.from(encodedSecret, "base64");
  } catch {
    return false;
  }
  if (secret.length === 0) return false;

  const signedContent = `${input.messageId}.${input.timestamp}.${input.payload}`;
  const expected = createHmac("sha256", secret)
    .update(signedContent, "utf8")
    .digest();
  const signatures = input.signature
    .trim()
    .split(/\s+/)
    .map((part) => part.split(",", 2))
    .filter(([version, signature]) => version === "v1" && Boolean(signature));

  return signatures.some(([, signature]) => {
    try {
      return safeEqual(expected, Buffer.from(signature!, "base64"));
    } catch {
      return false;
    }
  });
}
