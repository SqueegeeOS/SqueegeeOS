import { describe, expect, it } from "vitest";
import {
  resolveHomeownerEmailDestination,
  resolveHomeownerSmsDestination,
} from "./repository";
import type { CustomerContactPoint } from "./types";

function emailPoint(
  overrides: Partial<CustomerContactPoint> = {},
): CustomerContactPoint {
  return {
    id: "contact-1",
    homeownerId: "homeowner-1",
    channel: "email",
    addressNormalized: "member@example.com",
    addressMasked: "m***@example.com",
    isPrimary: false,
    verificationStatus: "unverified",
    verifiedAt: null,
    consentStatus: "unknown",
    consentSource: null,
    consentRecordedAt: null,
    optOutReason: null,
    createdAt: "2026-08-02T12:00:00.000Z",
    updatedAt: "2026-08-02T12:00:00.000Z",
    ...overrides,
  };
}

describe("homeowner email destination selection", () => {
  it("preserves a hard-bounce suppression for the raw homeowner email", () => {
    const destination = resolveHomeownerEmailDestination(
      [emailPoint({ verificationStatus: "invalid" })],
      "member@example.com",
    );

    expect(destination).toMatchObject({
      address: "member@example.com",
      contactPointId: "contact-1",
      verificationStatus: "invalid",
    });
  });

  it("uses a valid managed alternate instead of a bounced raw address", () => {
    const destination = resolveHomeownerEmailDestination(
      [
        emailPoint({ verificationStatus: "invalid" }),
        emailPoint({
          id: "contact-2",
          addressNormalized: "alternate@example.com",
          verificationStatus: "verified",
          verifiedAt: "2026-08-02T12:00:00.000Z",
          consentStatus: "opted_in",
        }),
      ],
      "member@example.com",
    );

    expect(destination).toMatchObject({
      address: "alternate@example.com",
      contactPointId: "contact-2",
      verificationStatus: "verified",
    });
  });
});

describe("homeowner SMS destination selection", () => {
  it("fails a changed phone closed until the exact new number is consented", () => {
    const oldPhone = emailPoint({
      id: "sms-old",
      channel: "sms",
      addressNormalized: "+15305550101",
      addressMasked: "***-***-0101",
      verificationStatus: "verified",
      consentStatus: "opted_in",
      isPrimary: true,
    });

    expect(resolveHomeownerSmsDestination([oldPhone], "+15305550102")).toEqual({
      address: "+15305550102",
      contactPointId: null,
      consentStatus: "unknown",
      verificationStatus: "unverified",
    });
    expect(resolveHomeownerSmsDestination([oldPhone], "+15305550101")).toEqual({
      address: "+15305550101",
      contactPointId: "sms-old",
      consentStatus: "opted_in",
      verificationStatus: "verified",
    });
  });
});
