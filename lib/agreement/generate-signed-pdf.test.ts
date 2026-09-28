import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  agreementBenefitsForPdf,
  generateEnrollmentAgreementPreviewPDF,
  generateSignedPDF,
} from "./generate-signed-pdf";
import { SQUEEGEEKING_TIERS } from "@/lib/membership/tier-config";

/** 2×2 dark PNG — visible when embedded on a white PDF page */
const signature =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function embeddedImageCount(bytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes);
  const raw = Buffer.from(await doc.save()).toString("latin1");
  const matches = raw.match(/\/Subtype\s*\/Image/g);
  return matches?.length ?? 0;
}

describe("generateSignedPDF", () => {
  it("does not promise window cleaning or treatments for a personalized solar plan", () => {
    const benefits = agreementBenefitsForPdf(SQUEEGEEKING_TIERS.biannual, true);
    expect(benefits.join(" ")).not.toMatch(/exterior window cleaning|rainblock/i);
    expect(benefits).toContain("Personalized Home Care Plan");
  });
  it("renders an unsigned agreement for review without embedding a signature", async () => {
    const bytes = await generateEnrollmentAgreementPreviewPDF({
      memberName: "Test User",
      signedAt: "2026-07-07T01:00:00.000Z",
      tier: "SqueegeeKing Bi-Annual Home Care Membership",
      agreementTier: "biannual",
      propertyName: "123 Main St",
      monthlyPrice: 208,
      carePlan: {
        version: 1,
        tier: "biannual",
        summary: "Solar panels twice yearly",
        customerChoiceNote: "Solar cleaning only",
        servicePrices: {
          exteriorWindows: 0,
          interiorWindows: 0,
          screens: 0,
          cobwebRemoval: 0,
          solarPanels: 0,
          pressureWashing: 0,
        },
        visits: [],
      },
      annualPrice: 416,
    });
    expect(bytes.byteLength).toBeGreaterThan(500);
    expect(await embeddedImageCount(bytes)).toBe(0);
  });
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
    expect(await embeddedImageCount(bytes)).toBeGreaterThanOrEqual(1);
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
    expect(await embeddedImageCount(bytes)).toBeGreaterThanOrEqual(1);
  });

  it("writes review PDFs when SAMPLE_PDF=1", async () => {
    if (process.env.SAMPLE_PDF !== "1") return;

    const { writeFileSync } = await import("fs");

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
