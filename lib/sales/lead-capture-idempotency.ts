import { createHash } from "node:crypto";

export interface CanonicalSalesLeadCapture {
  clientEventId: string;
  fullName: string;
  propertyAddress: string;
  phone: string | null;
  email: string | null;
  estimatedArrDollars: number;
  nextFollowUpAt: string | null;
  notes: string;
  smsConsentAttested: boolean;
  emailConsentAttested: boolean;
  doorMemoryClientEventId: string | null;
}

/**
 * Stable proof of the normalized first capture. Mutable lead fields can change
 * later without making a delayed mobile retry look like a different request.
 */
export function buildSalesLeadCaptureFingerprint(
  input: CanonicalSalesLeadCapture,
): string {
  const canonical = JSON.stringify({
    version: 1,
    clientEventId: input.clientEventId,
    fullName: input.fullName,
    propertyAddress: input.propertyAddress,
    phone: input.phone,
    email: input.email,
    estimatedArrCents: Math.round(input.estimatedArrDollars * 100),
    nextFollowUpAt: input.nextFollowUpAt,
    notes: input.notes,
    smsConsentAttested: input.smsConsentAttested,
    emailConsentAttested: input.emailConsentAttested,
    doorMemoryClientEventId: input.doorMemoryClientEventId,
  });

  return createHash("sha256").update(canonical).digest("hex");
}

export function salesLeadCaptureFingerprintMatches(
  storedFingerprint: string | null,
  input: CanonicalSalesLeadCapture,
): boolean {
  return (
    typeof storedFingerprint === "string" &&
    storedFingerprint === buildSalesLeadCaptureFingerprint(input)
  );
}
