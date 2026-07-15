import { describe, expect, it } from "vitest";
import {
  membershipLinkageConflictReason,
  presentationSourceSlug,
  propertyAuthorityAddressKey,
  signingEvidenceSha256,
} from "./signing-coherence";

describe("signing coherence guards", () => {
  it("isolates same-name customers by immutable presentation source", () => {
    const first = presentationSourceSlug(
      "Alex Homeowner",
      "11111111-1111-4111-8111-111111111111",
      "client",
    );
    const second = presentationSourceSlug(
      "Alex Homeowner",
      "22222222-2222-4222-8222-222222222222",
      "client",
    );
    expect(first).not.toBe(second);
    expect(first).toMatch(/^alex-homeowner-/);
  });

  it.each(["active", "paused", "cancelled"])(
    "holds an existing %s membership instead of overwriting it",
    (status) => {
      expect(
        membershipLinkageConflictReason(
          {
            id: "membership-id",
            presentation_id: "first-presentation",
            agreement_id: "agreement-id",
            status,
          },
          "second-presentation",
        ),
      ).toContain("different presentation");
    },
  );

  it("makes same evidence stable and conflicting evidence distinct", () => {
    const first = signingEvidenceSha256("data:image/png;base64,iVBORw0KGgo=");
    const replay = signingEvidenceSha256("data:image/png;base64,iVBORw0KGgo=");
    const conflict = signingEvidenceSha256("data:image/png;base64,iVBORw0KGgs=");
    expect(replay).toBe(first);
    expect(conflict).not.toBe(first);
  });

  it("normalizes case, surrounding whitespace, and ordinary spacing for property identity", () => {
    const canonical = propertyAuthorityAddressKey({
      address: "123 Main Street",
      city: "Chico",
      state: "CA",
      zip: "95928",
    });
    const variant = propertyAuthorityAddressKey({
      address: "  123   MAIN Street  ",
      city: " chico ",
      state: " ca ",
      zip: " 95928 ",
    });
    expect(variant).toBe(canonical);
    expect(
      propertyAuthorityAddressKey({
        address: "123 Main Street",
        city: "Chico",
        state: "CA",
        zip: "95929",
      }),
    ).not.toBe(canonical);
  });
});
