import { describe, expect, it } from "vitest";
import {
  isValidUsPostalCode,
  normalizeUsPostalCodeInput,
} from "./postal-code";

describe("US postal code input", () => {
  it.each([
    ["95928", "95928"],
    ["959281234", "95928-1234"],
    ["95928-1234", "95928-1234"],
    ["95928–1234", "95928-1234"],
    ["95928 1234", "95928-1234"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeUsPostalCodeInput(input)).toBe(expected);
  });

  it("accepts ZIP and ZIP+4 but rejects partial values", () => {
    expect(isValidUsPostalCode("95928")).toBe(true);
    expect(isValidUsPostalCode("95928-1234")).toBe(true);
    expect(isValidUsPostalCode("95928-12")).toBe(false);
  });
});
