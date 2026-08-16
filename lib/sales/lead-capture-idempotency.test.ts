import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  buildSalesLeadCaptureFingerprint,
  salesLeadCaptureFingerprintMatches,
  type CanonicalSalesLeadCapture,
} from "./lead-capture-idempotency";

const capture: CanonicalSalesLeadCapture = {
  clientEventId: "00000000-0000-4000-8000-000000000101",
  fullName: "Jordan Homeowner",
  propertyAddress: "123 Atlas Way",
  phone: "+15305550101",
  email: "jordan@example.com",
  serviceInterests: ["exterior_windows", "screens"],
  estimatedArrDollars: 1800,
  nextFollowUpAt: "2026-08-20T17:00:00.000Z",
  notes: "Interested in quarterly care.",
  smsConsentAttested: true,
  emailConsentAttested: true,
  doorMemoryClientEventId: "00000000-0000-4000-8000-000000000102",
};

describe("sales lead capture idempotency", () => {
  it("produces stable sha256 evidence for the same normalized capture", () => {
    const first = buildSalesLeadCaptureFingerprint(capture);
    const second = buildSalesLeadCaptureFingerprint({ ...capture });

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toBe(first);
    expect(salesLeadCaptureFingerprintMatches(first, capture)).toBe(true);
  });

  it("rejects reuse of a save reference for different capture content", () => {
    const fingerprint = buildSalesLeadCaptureFingerprint(capture);

    expect(
      salesLeadCaptureFingerprintMatches(fingerprint, {
        ...capture,
        propertyAddress: "999 Different Way",
      }),
    ).toBe(false);
    expect(salesLeadCaptureFingerprintMatches(null, capture)).toBe(false);
  });

  it("distinguishes service context and accepts a migration-first exterior retry", () => {
    const fingerprint = buildSalesLeadCaptureFingerprint(capture);
    expect(
      salesLeadCaptureFingerprintMatches(fingerprint, {
        ...capture,
        serviceInterests: ["exterior_windows"],
      }),
    ).toBe(false);

    const exteriorCapture = {
      ...capture,
      serviceInterests: [
        "exterior_windows",
      ] as CanonicalSalesLeadCapture["serviceInterests"],
    };
    const legacyCanonical = JSON.stringify({
      version: 1,
      clientEventId: exteriorCapture.clientEventId,
      fullName: exteriorCapture.fullName,
      propertyAddress: exteriorCapture.propertyAddress,
      phone: exteriorCapture.phone,
      email: exteriorCapture.email,
      estimatedArrCents: Math.round(exteriorCapture.estimatedArrDollars * 100),
      nextFollowUpAt: exteriorCapture.nextFollowUpAt,
      notes: exteriorCapture.notes,
      smsConsentAttested: exteriorCapture.smsConsentAttested,
      emailConsentAttested: exteriorCapture.emailConsentAttested,
      doorMemoryClientEventId: exteriorCapture.doorMemoryClientEventId,
    });
    const legacyFingerprint = createHash("sha256")
      .update(legacyCanonical)
      .digest("hex");

    expect(
      salesLeadCaptureFingerprintMatches(legacyFingerprint, exteriorCapture),
    ).toBe(true);
  });
});
