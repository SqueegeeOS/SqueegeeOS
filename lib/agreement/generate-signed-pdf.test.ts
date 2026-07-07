import { describe, expect, it } from "vitest";
import { generateSignedPDF } from "./generate-signed-pdf";

const signature =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("generateSignedPDF", () => {
  it("generates a quarterly membership agreement PDF", async () => {
    const bytes = await generateSignedPDF({
      memberName: "Test User",
      signedAt: "2026-07-07T01:00:00.000Z",
      signatureDataUrl: signature,
      tier: "SqueegeeKing Quarterly Home Care Membership",
      agreementTier: "quarterly",
      propertyName: "123 Main St",
      monthlyPrice: 249,
    });

    expect(bytes.byteLength).toBeGreaterThan(500);
  });
});
