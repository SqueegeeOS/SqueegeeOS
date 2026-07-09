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
import {
  AgreementPdfLayout,
  type SignaturePlacement,
} from "@/lib/agreement/pdf-layout";
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

/** Overlay coordinates for designer PDF templates (origin bottom-left). */
const TEMPLATE_SIGNATURE_PLACEMENT: Record<
  SqueegeeKingTierId,
  SignaturePlacement
> = {
  biannual: {
    pageIndex: -1,
    nameX: 72,
    nameY: 118,
    dateX: 360,
    dateY: 118,
    sigX: 72,
    sigY: 128,
    sigW: 220,
    sigH: 52,
  },
  quarterly: {
    pageIndex: -1,
    nameX: 72,
    nameY: 118,
    dateX: 360,
    dateY: 118,
    sigX: 72,
    sigY: 128,
    sigW: 220,
    sigH: 52,
  },
};

function formatSignedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  });
}

function formatSignedDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
}

function decodeSignatureDataUrl(
  dataUrl: string,
): { bytes: Uint8Array; mime: "png" | "jpeg" } | null {
  const match = dataUrl.match(/^data:image\/(png|jpeg);base64,(.+)$/i);
  if (!match?.[1] || !match[2]) return null;
  const mime = match[1].toLowerCase() === "jpeg" ? "jpeg" : "png";
  return {
    mime,
    bytes: Uint8Array.from(Buffer.from(match[2], "base64")),
  };
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
): Promise<{ pdfDoc: PDFDocument; signaturePlacement: SignaturePlacement }> {
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
  layout.drawParagraph(`Signed: ${formatSignedDateTime(input.signedAt)}`);

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

  layout.drawHeading(`${def.label} Membership`);
  layout.drawParagraph(
    `${formatAgreementDollars(pricing.membershipPerVisit)} per visit · ${pricing.visitsPerYear} visits per year`,
  );
  layout.drawParagraph(
    `Member discount on add-ons: ${def.addonDiscount}% off (while payments active)`,
  );
  layout.drawParagraph(
    `Annual membership: ${formatAgreementDollars(pricing.membershipAnnual)}`,
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

  const signaturePlacement = layout.reserveSignatureBlock("Member signature");

  return { pdfDoc, signaturePlacement };
}

async function buildProgrammaticOneTimeAgreement(
  input: GenerateSignedPDFInput,
): Promise<{ pdfDoc: PDFDocument; signaturePlacement: SignaturePlacement }> {
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
  layout.drawParagraph(`Signed: ${formatSignedDateTime(input.signedAt)}`);

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

  const signaturePlacement = layout.reserveSignatureBlock("Client signature");

  return { pdfDoc, signaturePlacement };
}

async function embedSignatureOnPage(
  pdfDoc: PDFDocument,
  pageIndex: number,
  input: GenerateSignedPDFInput,
  coords: SignaturePlacement,
) {
  const pages = pdfDoc.getPages();
  const resolvedIndex =
    pageIndex < 0 ? pages.length - 1 : Math.min(pageIndex, pages.length - 1);
  const page = pages[resolvedIndex];
  if (!page) return;

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const formattedDate = formatSignedDateTime(input.signedAt);

  page.drawText(`Printed name: ${input.memberName}`, {
    x: coords.nameX,
    y: coords.nameY,
    size: 10,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });

  page.drawText(`Signed: ${formattedDate}`, {
    x: coords.dateX,
    y: coords.dateY,
    size: 10,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });

  const decoded = decodeSignatureDataUrl(input.signatureDataUrl);
  if (!decoded || decoded.bytes.byteLength === 0) {
    throw new Error("Invalid or empty signature image");
  }

  const signatureImage =
    decoded.mime === "jpeg"
      ? await pdfDoc.embedJpg(decoded.bytes)
      : await pdfDoc.embedPng(decoded.bytes);

  page.drawImage(signatureImage, {
    x: coords.sigX,
    y: coords.sigY,
    width: coords.sigW,
    height: coords.sigH,
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
      const placement = {
        ...TEMPLATE_SIGNATURE_PLACEMENT.biannual,
        pageIndex: pdfDoc.getPageCount() - 1,
      };
      await embedSignatureOnPage(pdfDoc, placement.pageIndex, input, placement);
      return pdfDoc.save();
    }

    const built = await buildProgrammaticOneTimeAgreement(input);
    await embedSignatureOnPage(
      built.pdfDoc,
      built.signaturePlacement.pageIndex,
      input,
      built.signaturePlacement,
    );
    return built.pdfDoc.save();
  }

  const skTier = normalizeToSqueegeeKingTier(
    input.agreementTier ?? input.tier ?? "quarterly",
  );
  const templateBytes = await loadTemplateBytes("membership", skTier);

  if (templateBytes) {
    const pdfDoc = await PDFDocument.load(templateBytes);
    const placement = {
      ...TEMPLATE_SIGNATURE_PLACEMENT[skTier],
      pageIndex: pdfDoc.getPageCount() - 1,
    };
    await embedSignatureOnPage(pdfDoc, placement.pageIndex, input, placement);
    return pdfDoc.save();
  }

  const built = await buildProgrammaticAgreement(input, skTier);
  await embedSignatureOnPage(
    built.pdfDoc,
    built.signaturePlacement.pageIndex,
    input,
    built.signaturePlacement,
  );
  return built.pdfDoc.save();
}
