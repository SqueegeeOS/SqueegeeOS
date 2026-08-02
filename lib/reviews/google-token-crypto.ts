import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const TOKEN_FORMAT_VERSION = "v1";

function readEncryptionKey(): Buffer {
  const configured =
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.JOBBER_TOKEN_ENCRYPTION_KEY?.trim();

  if (!configured) {
    throw new Error(
      "GOOGLE_TOKEN_ENCRYPTION_KEY or JOBBER_TOKEN_ENCRYPTION_KEY is not configured",
    );
  }

  const key = /^[a-f0-9]{64}$/i.test(configured)
    ? Buffer.from(configured, "hex")
    : Buffer.from(configured, "base64");

  if (key.length !== 32) {
    throw new Error("Google token encryption key must decode to exactly 32 bytes");
  }

  return key;
}

export function getGoogleTokenEncryptionKeyStatus(): {
  configured: boolean;
  valid: boolean;
  ready: boolean;
} {
  const configured = Boolean(
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY?.trim() ||
      process.env.JOBBER_TOKEN_ENCRYPTION_KEY?.trim(),
  );
  if (!configured) return { configured: false, valid: false, ready: false };
  try {
    readEncryptionKey();
    return { configured: true, valid: true, ready: true };
  } catch {
    return { configured: true, valid: false, ready: false };
  }
}

export function encryptGoogleToken(plaintext: string): string {
  if (!plaintext) throw new Error("Cannot encrypt an empty Google OAuth token");

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", readEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    TOKEN_FORMAT_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptGoogleToken(value: string): string {
  const [version, encodedIv, encodedTag, encodedCiphertext] = value.split(".");
  if (
    version !== TOKEN_FORMAT_VERSION ||
    !encodedIv ||
    !encodedTag ||
    !encodedCiphertext
  ) {
    throw new Error("Unsupported Google token ciphertext format");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    readEncryptionKey(),
    Buffer.from(encodedIv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
