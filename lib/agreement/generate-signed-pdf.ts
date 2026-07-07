import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "fs";
import path from "path";
import {
  ADDON_DISCOUNT_FINE_PRINT,
  agreementTemplateFilename,
  normalizeToSqueegeeKingTier,
  planNameForAgreement,
  SQUEEGEEKING_TIERS,
  type SqueegeeKingTierId,
} from "@/lib/membership/tier-config";
import {
  buildAgreementPricingSnapshot,
  formatAgreementDollars,
  type AgreementPricingSnapshot,
} from "@/lib/agreement/agreement-pricing";
import { MEMBERSHIP_BILLING_FINE_PRINT_BODY } from "@/lib/agreement/agreement-content";
import { AgreementPdfLayout } from "@/lib/agreement/pdf-layout";
import type { AgreementKind } from "@/lib/agreement/one-time-agreement";
import type { PresentationQuoteSnapshot } from "@/lib/presentations/quote-snapshot";
import {
  ONE_TIME_AGREEMENT_TITLE,
  ONE_TIME_AGREEMENT_TEMPLATE,
  ONE_TIME_SERVICE_SCOPE,
} from "@/lib/agreement/one-time-agreement";

export interface GenerateSignedPDFInput {
  memberName: string;
  signedAt: string;
  signatureDataUrl: string;
  tier: string;
  agreementTier?: SqueegeeKingTierId;
  agreementKind?: AgreementKind;
  propertyName: string;
  monthlyPrice?: number;
  homeSqft?: number;
  twoStory?: boolean;
  includeScreens?: boolean;
  includeInterior?: boolean;
  quoteSnapshot?: PresentationQuoteSnapshot | null;
  pricingSnapshot?: AgreementPricingSnapshot;
}

function formatSignedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

async function loadTemplateBytes(
  kind: AgreementKind,
  tier: SqueegeeKingTierId,
): Promise<Uint8Array | null> {
  const filename =
    kind === "one_time"
      ? ONE_TIME_AGREEMENT_TEMPLATE
      : agreementTemplateFilename(tier);
  const templatePath = path.join(process.cwd(), "public/documents", filename);
  try {
    await fs.promises.access(templatePath);
    return fs.readFileSync(templatePath);
  } catch {
    if (kind === "one_time") {
      return null;
    }
    const legacyPath = path.join(
      process.cwd(),
      "public/documents/homeatlas-agreement.pdf",
    );
    try {
      await fs.promises.access(legacyPath);
      return fs.readFileSync(legacyPath);
    } catch {
      return null;
    }
  }
}

async function buildProgrammaticAgreement(
  input: GenerateSignedPDFInput,
  skTier: SqueegeeKingTierId,
): Promise<PDFDocument> {
  const def = SQUEEGEEKING_TIERS[skTier];
  const pricing =
    input.pricingSnapshot ??
    buildAgreementPricingSnapshot({
      tier: skTier,
      visitPrice: input.monthlyPrice,
      quoteSnapshot: input.quoteSnapshot,
      homeSqft: input.homeSqft,
      twoStory: input.twoStory,
      includeScreens: input.includeScreens,
      includeInterior: input.includeInterior,
    });

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const layout = new AgreementPdfLayout(pdfDoc, font, fontBold);

  layout.drawParagraph(planNameForAgreement(skTier).toUpperCase(), {
    size: 14,
    bold: true,
  });
  layout.gap(6);
  layout.drawParagraph(`Member: ${input.memberName}`);
  layout.drawParagraph(`Property: ${input.propertyName}`);
  layout.drawParagraph(`Signed: ${formatSignedDate(input.signedAt)}`);

  layout.drawHeading("Membership Benefits");
  for (const benefit of def.benefits) {
    layout.drawBullet(benefit);
  }

  if (def.exclusions.length > 0) {
    layout.drawHeading("Upgrade to Quarterly for");
    for (const item of def.exclusions) {
      layout.drawParagraph(`  —  ${item}`, { size: 9 });
    }
  }

  layout.drawHeading(`${def.label} Investment`);
  layout.drawParagraph(
    `${formatAgreementDollars(pricing.membershipPerVisit)} per visit · ${pricing.visitsPerYear} visits per year`,
  );
  layout.drawParagraph(
    `Member discount on add-ons: ${def.addonDiscount}% off (while payments active)`,
  );
  layout.drawParagraph(
    `Annual membership investment: ${formatAgreementDollars(pricing.membershipAnnual)}`,
    { bold: true },
  );

  if (pricing.kind === "included") {
    layout.drawQuarterlyIncludedHighlight(pricing);
  } else {
    layout.drawBiannualSavingsHighlight(pricing);
  }

  layout.drawHeading("Terms — Billing & Payment");
  layout.drawParagraph(MEMBERSHIP_BILLING_FINE_PRINT_BODY, {
    size: 8,
    lineHeight: 12,
  });

  layout.drawHeading("Terms — Add-On Service Discount");
  layout.drawParagraph(
    ADDON_DISCOUNT_FINE_PRINT.replace(/^ADD-ON SERVICE DISCOUNT\s*\n+/i, "").trim(),
    { size: 8, lineHeight: 12 },
  );

  layout.reserveSignatureBlock("Member signature");

  return pdfDoc;
}

async function buildProgrammaticOneTimeAgreement(
  input: GenerateSignedPDFInput,
): Promise<PDFDocument> {
  const visitPrice = input.monthlyPrice ?? 0;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const layout = new AgreementPdfLayout(pdfDoc, font, fontBold);

  layout.drawParagraph(ONE_TIME_AGREEMENT_TITLE.toUpperCase(), {
    size: 14,
    bold: true,
  });
  layout.gap(6);
  layout.drawParagraph(`Client: ${input.memberName}`);
  layout.drawParagraph(`Property: ${input.propertyName}`);
  layout.drawParagraph(`Signed: ${formatSignedDate(input.signedAt)}`);

  layout.drawHeading("One-Time Service — Not a Membership");
  layout.drawParagraph(
    "This agreement covers a single scheduled visit only. No recurring membership, member portal access, priority booking, or add-on discounts are included unless you separately enroll in a membership plan.",
    { size: 9 },
  );

  layout.drawHeading("Scope of Work");
  for (const item of ONE_TIME_SERVICE_SCOPE) {
    layout.drawBullet(item);
  }

  layout.drawHeading("Visit Price");
  layout.drawParagraph(formatAgreementDollars(visitPrice), { bold: true });
  layout.drawParagraph("Payment: Due per booking terms agreed at scheduling.");

  layout.drawHeading("7-Day Workmanship Guarantee");
  layout.drawParagraph(
    "If you are not satisfied with workmanship on the completed visit, contact us within seven (7) days and we will make it right.",
    { size: 9 },
  );

  layout.drawHeading("Exclusions");
  layout.drawParagraph("  —  No RainBlock or Hard Water unless explicitly quoted", {
    size: 9,
  });
  layout.drawParagraph("  —  No member pricing on future add-on services", { size: 9 });
  layout.drawParagraph("  —  No automatic rebooking or recurring billing", { size: 9 });

  layout.reserveSignatureBlock("Client signature");

  return pdfDoc;
}

async function embedSignatureOnPage(
  pdfDoc: PDFDocument,
  pageIndex: number,
  input: GenerateSignedPDFInput,
  coords?: {
    nameX: number;
    nameY: number;
    dateX: number;
    dateY: number;
    sigX: number;
    sigY: number;
    sigW: number;
    sigH: number;
  },
) {
  const pages = pdfDoc.getPages();
  const page = pages[pageIndex] ?? pages[pages.length - 1];
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const formattedDate = formatSignedDate(input.signedAt);

  const c = coords ?? {
    nameX: 120,
    nameY: 142,
    dateX: 380,
    dateY: 142,
    sigX: 120,
    sigY: 155,
    sigW: 180,
    sigH: 50,
  };

  page.drawText(input.memberName, {
    x: c.nameX,
    y: c.nameY,
    size: 11,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });

  page.drawText(formattedDate, {
    x: c.dateX,
    y: c.dateY,
    size: 11,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });

  const base64 = input.signatureDataUrl.replace(/^data:image\/png;base64,/, "");
  const signatureBytes = Buffer.from(base64, "base64");
  const signatureImage = await pdfDoc.embedPng(signatureBytes);

  page.drawImage(signatureImage, {
    x: c.sigX,
    y: c.sigY,
    width: c.sigW,
    height: c.sigH,
  });
}

export async function generateSignedPDF(
  input: GenerateSignedPDFInput,
): Promise<Uint8Array> {
  const agreementKind = input.agreementKind ?? "membership";

  if (agreementKind === "one_time") {
    const templateBytes = await loadTemplateBytes("one_time", "biannual");
    if (templateBytes) {
      const pdfDoc = await PDFDocument.load(templateBytes);
      await embedSignatureOnPage(pdfDoc, pdfDoc.getPageCount() - 1, input);
      return pdfDoc.save();
    }

    const pdfDoc = await buildProgrammaticOneTimeAgreement(input);
    await embedSignatureOnPage(pdfDoc, 0, input, {
      nameX: 72,
      nameY: 72,
      dateX: 360,
      dateY: 72,
      sigX: 72,
      sigY: 82,
      sigW: 200,
      sigH: 56,
    });
    return pdfDoc.save();
  }

  const skTier = normalizeToSqueegeeKingTier(
    input.agreementTier ?? input.tier ?? "quarterly",
  );
  const templateBytes = await loadTemplateBytes("membership", skTier);

  if (templateBytes) {
    const pdfDoc = await PDFDocument.load(templateBytes);
    await embedSignatureOnPage(pdfDoc, pdfDoc.getPageCount() - 1, input);
    return pdfDoc.save();
  }

  const pdfDoc = await buildProgrammaticAgreement(input, skTier);
  const signaturePage = Math.max(0, pdfDoc.getPageCount() - 1);
  const signatureY = 120;
  await embedSignatureOnPage(pdfDoc, signaturePage, input, {
    nameX: 72,
    nameY: signatureY,
    dateX: 360,
    dateY: signatureY,
    sigX: 72,
    sigY: signatureY + 10,
    sigW: 200,
    sigH: 56,
  });
  return pdfDoc.save();
}
