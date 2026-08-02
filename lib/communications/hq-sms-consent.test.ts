import { describe, expect, it } from "vitest";
import {
  HqSmsConsentError,
  validateHqSmsConsentInput,
} from "./hq-sms-consent";

describe("HQ SMS consent input", () => {
  it("requires explicit attestation and durable evidence for opt-in", () => {
    expect(() =>
      validateHqSmsConsentInput({
        action: "record_opt_in",
        phone: "(530) 555-0101",
        evidenceNote: "Customer said yes",
        attested: false,
        idempotencyKey: "hq-consent:decision-1",
      }),
    ).toThrowError(HqSmsConsentError);

    expect(
      validateHqSmsConsentInput({
        action: "record_opt_in",
        phone: "(530) 555-0101",
        evidenceNote: "Customer explicitly agreed by phone on August 2.",
        attested: true,
        idempotencyKey: "hq-consent:decision-2",
      }),
    ).toMatchObject({
      action: "record_opt_in",
      phone: "+15305550101",
      attested: true,
    });
  });

  it("lets HQ record an immediate opt-out without inventing opt-in evidence", () => {
    expect(
      validateHqSmsConsentInput({
        action: "record_opt_out",
        phone: "+15305550101",
        evidenceNote: "",
        attested: false,
        idempotencyKey: "hq-consent:decision-3",
      }),
    ).toEqual({
      action: "record_opt_out",
      phone: "+15305550101",
      evidenceNote: "",
      attested: false,
      idempotencyKey: "hq-consent:decision-3",
    });
  });
});
