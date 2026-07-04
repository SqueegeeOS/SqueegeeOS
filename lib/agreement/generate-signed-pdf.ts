import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "fs";
import path from "path";
import {
  ADDON_DISCOUNT_FINE_PRINT,
  agreementTemplateFilename,
  calculateAnnualFromVisits,
  HARDWATER_RETAIL_VALUE,
  normalizeToSqueegeeKingTier,
  planNameForAgreement,
  QUARTERLY_INCLUDED_TREATMENT_ANNUAL,
  RAINBLOCK_RETAIL_VALUE,
  SQUEEGEEKING_TIERS,
  type SqueegeeKingTierId,
} from "@/lib/membership/tier-config";
import { MEMBERSHIP_BILLING_FINE_PRINT } from "@/lib/agreement/agreement-content";
import type { AgreementKind } from "@/lib/agreement/one-time-agreement";
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
  const visitPrice = input.monthlyPrice ?? def.defaultVisitPrice;
  const annualTotal = calculateAnnualFromVisits(skTier, visitPrice);

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { height } = page.getSize();
  let y = height - 56;

  const draw = (text: string, size = 10, bold = false) => {
    const lines = text.split("\n");
    for (const line of lines) {
      page.drawText(line, {
        x: 54,
        y,
        size,
        font: bold ? fontBold : font,
        color: rgb(0.1, 0.1, 0.1),
        maxWidth: 504,
      });
      y -= size * 1.45;
    }
  };

  draw(planNameForAgreement(skTier).toUpperCase(), 14, true);
  y -= 6;
  draw(`Member: ${input.memberName}`, 10);
  draw(`Property: ${input.propertyName}`, 10);
  draw(`Signed: ${formatSignedDate(input.signedAt)}`, 10);
  y -= 8;
  draw("MEMBERSHIP BENEFITS", 11, true);
  y -= 4;

  for (const benefit of def.benefits) {
    draw(`  ◈  ${benefit}`, 9);
  }

  if (def.exclusions.length > 0) {
    y -= 6;
    draw("Upgrade to Quarterly for:", 10, true);
    for (const item of def.exclusions) {
      draw(`  — ${item}`, 9);
    }
  }

  y -= 10;
  draw(
    `${def.label.toUpperCase()} INVESTMENT: $${visitPrice} / visit`,
    10,
    true,
  );
  draw(
    `MEMBER DISCOUNT ON ADD-ONS: ${def.addonDiscount}% OFF (while payments active)`,
    10,
  );
  draw(`ANNUAL TOTAL: $${annualTotal}`, 10);

  if (skTier === "quarterly") {
    draw(
      `ANNUAL VALUE INCLUDED: $${QUARTERLY_INCLUDED_TREATMENT_ANNUAL} in RainBlock ($${RAINBLOCK_RETAIL_VALUE}/visit) + Hard Water ($${HARDWATER_RETAIL_VALUE}/visit) treatments`,
      9,
    );
  }

  y -= 12;
  draw("TERMS — BILLING & PAYMENT", 10, true);
  for (const line of MEMBERSHIP_BILLING_FINE_PRINT.split("\n")) {
    draw(line, 8);
  }

  y -= 12;
  draw("TERMS — ADD-ON SERVICE DISCOUNT", 10, true);
  for (const line of ADDON_DISCOUNT_FINE_PRINT.split("\n")) {
    draw(line, 8);
  }

  y -= 16;
  draw("Member signature", 11, true);

  return pdfDoc;
}

async function buildProgrammaticOneTimeAgreement(
  input: GenerateSignedPDFInput,
): Promise<PDFDocument> {
  const visitPrice = input.monthlyPrice ?? 0;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { height } = page.getSize();
  let y = height - 56;

  const draw = (text: string, size = 10, bold = false) => {
    const lines = text.split("\n");
    for (const line of lines) {
      page.drawText(line, {
        x: 54,
        y,
        size,
        font: bold ? fontBold : font,
        color: rgb(0.1, 0.1, 0.1),
        maxWidth: 504,
      });
      y -= size * 1.45;
    }
  };

  draw(ONE_TIME_AGREEMENT_TITLE.toUpperCase(), 14, true);
  y -= 6;
  draw(`Client: ${input.memberName}`, 10);
  draw(`Property: ${input.propertyName}`, 10);
  draw(`Signed: ${formatSignedDate(input.signedAt)}`, 10);
  y -= 8;
  draw("ONE-TIME SERVICE — NOT A MEMBERSHIP", 11, true);
  y -= 4;
  draw(
    "This agreement covers a single scheduled visit only. No recurring membership, member portal access, priority booking, or add-on discounts are included unless you separately enroll in a membership plan.",
    9,
  );
  y -= 8;
  draw("SCOPE OF WORK", 11, true);
  y -= 4;
  for (const item of ONE_TIME_SERVICE_SCOPE) {
    draw(`  ◈  ${item}`, 9);
  }
  y -= 10;
  draw(`VISIT PRICE: $${visitPrice}`, 10, true);
  draw("PAYMENT: Due per booking terms agreed at scheduling.", 10);
  y -= 8;
  draw("7-DAY WORKMANSHIP GUARANTEE", 11, true);
  draw(
    "If you are not satisfied with workmanship on the completed visit, contact us within seven (7) days and we will make it right.",
    9,
  );
  y -= 12;
  draw("EXCLUSIONS", 10, true);
  draw("  —  No RainBlock or Hard Water unless explicitly quoted", 9);
  draw("  —  No member pricing on future add-on services", 9);
  draw("  —  No automatic rebooking or recurring billing", 9);
  y -= 16;
  draw("Client signature", 11, true);

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
