import { describe, expect, it } from "vitest";
import {
  enrollmentTokenMatches,
  enrollmentTokenSha256,
  generateEnrollmentToken,
  isPlausibleEnrollmentToken,
} from "./token";

describe("enrollment customer-link tokens", () => {
  it("creates opaque tokens and stores only a one-way digest", () => {
    const token = generateEnrollmentToken();
    const digest = enrollmentTokenSha256(token);

    expect(isPlausibleEnrollmentToken(token)).toBe(true);
    expect(token).not.toBe(digest);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(enrollmentTokenMatches(token, digest)).toBe(true);
  });

  it("rejects malformed and mismatched tokens without throwing", () => {
    const token = generateEnrollmentToken();
    const otherToken = generateEnrollmentToken();

    expect(enrollmentTokenMatches(otherToken, enrollmentTokenSha256(token))).toBe(
      false,
    );
    expect(enrollmentTokenMatches("short", enrollmentTokenSha256(token))).toBe(
      false,
    );
    expect(enrollmentTokenMatches(token, "not-a-digest")).toBe(false);
  });
});
