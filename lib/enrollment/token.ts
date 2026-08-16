import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_BYTES = 32;

export function generateEnrollmentToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}
export function enrollmentTokenSha256(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isPlausibleEnrollmentToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{40,80}$/.test(token);
}

export function enrollmentTokenMatches(token: string, expectedSha256: string): boolean {
  if (!isPlausibleEnrollmentToken(token) || !/^[0-9a-f]{64}$/.test(expectedSha256)) {
    return false;
  }
  const actual = Buffer.from(enrollmentTokenSha256(token), "hex");
  const expected = Buffer.from(expectedSha256, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
