import { describe, expect, it } from "vitest";
import { isValidEnrollmentPreviewToken } from "./preview-access";

const token = "a".repeat(64);

describe("enrollment preview access", () => {
  it("accepts only the exact opaque preview token", () => {
    expect(isValidEnrollmentPreviewToken(token, token)).toBe(true);
    expect(isValidEnrollmentPreviewToken("b".repeat(64), token)).toBe(false);
  });

  it("rejects missing and malformed values", () => {
    expect(isValidEnrollmentPreviewToken("", token)).toBe(false);
    expect(isValidEnrollmentPreviewToken("preview", token)).toBe(false);
    expect(isValidEnrollmentPreviewToken(token, "")).toBe(false);
  });
});
