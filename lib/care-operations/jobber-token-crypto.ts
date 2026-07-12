import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "crypto";

const TOKEN_FORMAT_VERSION = "v1";

function readEncryptionKey(): Buffer {
  const configured = process.env.JOBBER_TOKEN_ENCRYPTION_KEY?.trim();
  if (!configured) {
    throw new Error("JOBBER_TOKEN_ENCRYPTION_KEY is not configured");
  }

  const key = /^[a-f0-9]{64}$/i.test(configured)
    ? Buffer.from(configured, "hex")
    : Buffer.from(configured, "base64");
  if (key.length !== 32) {
    throw new Error(
      "JOBBER_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes",
    );
  }
  return key;
}

export function encryptJobberToken(plaintext: string): string {
  if (!plaintext) throw new Error("Cannot encrypt an empty Jobber token");
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

export function decryptJobberToken(value: string): string {
  const [version, encodedIv, encodedTag, encodedCiphertext] = value.split(".");
  if (
    version !== TOKEN_FORMAT_VERSION ||
    !encodedIv ||
    !encodedTag ||
    !encodedCiphertext
  ) {
    throw new Error("Unsupported Jobber token ciphertext format");
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
