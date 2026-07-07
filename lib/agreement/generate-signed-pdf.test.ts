import { describe, expect, it } from "vitest";
import { writeFileSync } from "fs";
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
      homeSqft: 2500,
    });

    expect(bytes.byteLength).toBeGreaterThan(500);
  });

  it("generates a bi-annual membership agreement PDF with savings block", async () => {
    const bytes = await generateSignedPDF({
      memberName: "Test User",
      signedAt: "2026-07-07T01:00:00.000Z",
      signatureDataUrl: signature,
      tier: "SqueegeeKing Bi-Annual Home Care Membership",
      agreementTier: "biannual",
      propertyName: "123 Main St",
      monthlyPrice: 320,
      homeSqft: 2500,
    });

    expect(bytes.byteLength).toBeGreaterThan(500);
  });

  it("writes review PDFs when SAMPLE_PDF=1", async () => {
    if (process.env.SAMPLE_PDF !== "1") return;

    const quarterly = await generateSignedPDF({
      memberName: "Larry Buckley",
      signedAt: "2026-07-07T03:00:00.000Z",
      signatureDataUrl: signature,
      tier: "SqueegeeKing Quarterly Home Care Membership",
      agreementTier: "quarterly",
      propertyName: "Canyon Oaks Residence — 1842 Canyon View Dr",
      monthlyPrice: 249,
      homeSqft: 2500,
    });
    writeFileSync("public/documents/sample-quarterly-signed-agreement.pdf", quarterly);

    const biannual = await generateSignedPDF({
      memberName: "Larry Buckley",
      signedAt: "2026-07-07T03:00:00.000Z",
      signatureDataUrl: signature,
      tier: "SqueegeeKing Bi-Annual Home Care Membership",
      agreementTier: "biannual",
      propertyName: "Canyon Oaks Residence — 1842 Canyon View Dr",
      monthlyPrice: 320,
      homeSqft: 2500,
    });
    writeFileSync("public/documents/sample-biannual-signed-agreement.pdf", biannual);
  });
});
