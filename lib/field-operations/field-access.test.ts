import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  FIELD_SESSION_COOKIE_NAME,
  fieldSessionTokenFromHeaders,
  hashFieldAccessToken,
  isFieldAccessToken,
  issueOpaqueFieldToken,
} from "./field-access";

describe("technician field access tokens", () => {
  it("issues 256-bit URL-safe opaque tokens and stores only deterministic hashes", () => {
    const token = issueOpaqueFieldToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(isFieldAccessToken(token)).toBe(true);
    expect(hashFieldAccessToken(token)).toBe(
      createHash("sha256").update(token).digest("hex"),
    );
    expect(hashFieldAccessToken(token)).not.toContain(token);
  });

  it("reads only a correctly formed Field Pass cookie", () => {
    const token = issueOpaqueFieldToken();
    const headers = new Headers({
      cookie: `unrelated=value; ${FIELD_SESSION_COOKIE_NAME}=${token}; another=1`,
    });
    expect(fieldSessionTokenFromHeaders(headers)).toBe(token);
    expect(
      fieldSessionTokenFromHeaders(
        new Headers({ cookie: `${FIELD_SESSION_COOKIE_NAME}=short` }),
      ),
    ).toBeNull();
  });

  it("rejects malformed and padded token values", () => {
    expect(isFieldAccessToken("")).toBe(false);
    expect(isFieldAccessToken("a".repeat(42))).toBe(false);
    expect(isFieldAccessToken(`${"a".repeat(42)}=`)).toBe(false);
    expect(isFieldAccessToken("a".repeat(44))).toBe(false);
  });
});
