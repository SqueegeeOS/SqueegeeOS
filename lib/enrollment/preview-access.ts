import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function isValidEnrollmentPreviewToken(
  token: string,
  expectedToken = process.env.HOMEATLAS_ENROLLMENT_PREVIEW_TOKEN?.trim() ?? "",
): boolean {
  if (!TOKEN_PATTERN.test(token) || !TOKEN_PATTERN.test(expectedToken)) {
    return false;
  }
  return timingSafeEqual(digest(token), digest(expectedToken));
}
