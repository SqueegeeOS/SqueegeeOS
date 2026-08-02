import { describe, expect, it } from "vitest";
import {
  getProviderConfigState,
  normalizeE164,
  normalizeProviderDeliveryStatus,
} from "./contracts";

describe("communication provider contracts", () => {
  it("accepts only E.164 phone numbers", () => {
    expect(normalizeE164(" +15305886235 ")).toBe("+15305886235");
    expect(normalizeE164("5305886235")).toBeNull();
    expect(normalizeE164("+0123456789")).toBeNull();
    expect(normalizeE164("whatsapp:+15305886235")).toBeNull();
  });

  it("normalizes provider-specific lifecycle statuses", () => {
    expect(normalizeProviderDeliveryStatus("scheduled")).toBe("queued");
    expect(normalizeProviderDeliveryStatus("email.delivery_delayed")).toBe(
      "delayed",
    );
    expect(normalizeProviderDeliveryStatus("cancelled")).toBe("canceled");
    expect(normalizeProviderDeliveryStatus("something-new")).toBe("unknown");
  });

  it("reports configuration names without exposing values", () => {
    const state = getProviderConfigState({
      TWILIO_AUTH_TOKEN: "secret-token",
      TWILIO_FROM_NUMBER: "",
    });

    expect(state).toEqual({
      configured: false,
      missing: ["TWILIO_FROM_NUMBER"],
    });
    expect(JSON.stringify(state)).not.toContain("secret-token");
  });
});
