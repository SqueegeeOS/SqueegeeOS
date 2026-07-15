import { describe, expect, it } from "vitest";
import {
  parsePublicSignAgreementInput,
  SIGNATURE_MAX_DECODED_BYTES,
} from "./sign-agreement-input";

const PRESENTATION_ID = "43f4f95d-cae4-4f68-b672-29d56d6f7b5f";
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("public signing authority input", () => {
  it("accepts only capability, allowed tier, and PNG signature evidence", () => {
    expect(
      parsePublicSignAgreementInput({
        presentationId: PRESENTATION_ID,
        agreementTier: "quarterly",
        signatureDataUrl: PNG,
      }),
    ).toEqual({
      presentationId: PRESENTATION_ID,
      agreementTier: "quarterly",
      signatureDataUrl: PNG,
    });
  });

  it.each([
    ["client price", { monthlyPrice: 1 }],
    ["client customer id", { homeownerId: PRESENTATION_ID }],
    ["client source link", { membershipId: PRESENTATION_ID }],
    ["client signing timestamp", { signedAt: "2020-01-01T00:00:00Z" }],
  ])("rejects %s", (_label, extra) => {
    expect(
      parsePublicSignAgreementInput({
        presentationId: PRESENTATION_ID,
        agreementTier: "quarterly",
        signatureDataUrl: PNG,
        ...extra,
      }),
    ).toBeNull();
  });

  it("rejects malformed capabilities, tiers, and non-PNG payloads", () => {
    expect(
      parsePublicSignAgreementInput({
        presentationId: "presentation-1",
        agreementTier: "quarterly",
        signatureDataUrl: PNG,
      }),
    ).toBeNull();
    expect(
      parsePublicSignAgreementInput({
        presentationId: PRESENTATION_ID,
        agreementTier: "quarterly",
        signatureDataUrl: "data:image/png;base64,iVBORw0KGgo=",
      }),
    ).toBeNull();
    expect(
      parsePublicSignAgreementInput({
        presentationId: PRESENTATION_ID,
        agreementTier: "monthly",
        signatureDataUrl: PNG,
      }),
    ).toBeNull();
    expect(
      parsePublicSignAgreementInput({
        presentationId: PRESENTATION_ID,
        agreementTier: "quarterly",
        signatureDataUrl: "data:image/png;base64,ZmFrZQ==",
      }),
    ).toBeNull();
  });

  it("rejects decoded signatures over the byte limit", () => {
    const oversized = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      Buffer.alloc(SIGNATURE_MAX_DECODED_BYTES),
    ]).toString("base64");
    expect(
      parsePublicSignAgreementInput({
        presentationId: PRESENTATION_ID,
        agreementTier: "biannual",
        signatureDataUrl: `data:image/png;base64,${oversized}`,
      }),
    ).toBeNull();
  });
});
