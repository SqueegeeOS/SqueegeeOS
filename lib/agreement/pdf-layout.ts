import {
  PDFDocument,
  type PDFPage,
  type PDFFont,
  rgb,
} from "pdf-lib";
import type {
  BiannualAgreementPricing,
  QuarterlyAgreementPricing,
} from "@/lib/agreement/agreement-pricing";
import { formatAgreementDollars } from "@/lib/agreement/agreement-pricing";

export const PDF_PAGE_SIZE: [number, number] = [612, 792];
const MARGIN_LEFT = 54;
const MARGIN_RIGHT = 54;
const MARGIN_TOP = 56;
const MARGIN_BOTTOM = 80;

const BODY_COLOR = rgb(0.1, 0.1, 0.1);
const MUTED_COLOR = rgb(0.35, 0.35, 0.35);
const ACCENT_FILL = rgb(0.96, 0.94, 0.9);
const ACCENT_BORDER = rgb(0.72, 0.62, 0.42);

export class AgreementPdfLayout {
  private page: PDFPage;
  private y: number;

  constructor(
    private readonly pdfDoc: PDFDocument,
    private readonly font: PDFFont,
    private readonly fontBold: PDFFont,
  ) {
    this.page = pdfDoc.addPage(PDF_PAGE_SIZE);
    this.y = PDF_PAGE_SIZE[1] - MARGIN_TOP;
  }

  private contentWidth(): number {
    return PDF_PAGE_SIZE[0] - MARGIN_LEFT - MARGIN_RIGHT;
  }

  private wrapLine(text: string, activeFont: PDFFont, size: number): string[] {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];

    const lines: string[] = [];
    let current = words[0] ?? "";

    for (let index = 1; index < words.length; index += 1) {
      const word = words[index];
      const candidate = `${current} ${word}`;
      const width = activeFont.widthOfTextAtSize(candidate, size);
      if (width > this.contentWidth()) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }

    lines.push(current);
    return lines;
  }

  private wrapParagraph(text: string, activeFont: PDFFont, size: number): string[] {
    return text
      .split("\n")
      .flatMap((segment) => this.wrapLine(segment, activeFont, size));
  }

  ensureSpace(height: number): void {
    if (this.y - height >= MARGIN_BOTTOM) return;
    this.page = this.pdfDoc.addPage(PDF_PAGE_SIZE);
    this.y = PDF_PAGE_SIZE[1] - MARGIN_TOP;
  }

  gap(amount: number): void {
    this.y -= amount;
  }

  drawParagraph(
    text: string,
    options: {
      size?: number;
      bold?: boolean;
      lineHeight?: number;
    } = {},
  ): void {
    const size = options.size ?? 10;
    const activeFont = options.bold ? this.fontBold : this.font;
    const lineHeight = options.lineHeight ?? size * 1.55;
    const lines = this.wrapParagraph(text, activeFont, size);

    for (const line of lines) {
      this.ensureSpace(lineHeight);
      this.page.drawText(line, {
        x: MARGIN_LEFT,
        y: this.y,
        size,
        font: activeFont,
        color: BODY_COLOR,
      });
      this.y -= lineHeight;
    }
  }

  drawHeading(text: string, size = 11): void {
    this.gap(12);
    this.drawParagraph(text, { size, bold: true });
    this.gap(8);
  }

  drawBullet(text: string, size = 9): void {
    this.drawParagraph(`  -  ${text}`, { size });
  }

  private drawCenteredAt(
    text: string,
    y: number,
    options: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb> } = {},
  ): void {
    const size = options.size ?? 10;
    const activeFont = options.bold ? this.fontBold : this.font;
    const width = activeFont.widthOfTextAtSize(text, size);
    const x = (PDF_PAGE_SIZE[0] - width) / 2;

    this.page.drawText(text, {
      x,
      y,
      size,
      font: activeFont,
      color: options.color ?? BODY_COLOR,
    });
  }

  private drawBox(height: number): number {
    this.ensureSpace(height + 12);
    const topY = this.y;
    const bottomY = topY - height;

    this.page.drawRectangle({
      x: MARGIN_LEFT,
      y: bottomY,
      width: this.contentWidth(),
      height,
      color: ACCENT_FILL,
      borderColor: ACCENT_BORDER,
      borderWidth: 1,
    });

    return topY;
  }

  private drawMathBlock(
    topY: number,
    startOffset: number,
    rows: Array<{ label: string; detail: string }>,
  ): number {
    let rowY = topY - startOffset;
    for (const row of rows) {
      this.page.drawText(row.label, {
        x: MARGIN_LEFT + 20,
        y: rowY,
        size: 9,
        font: this.fontBold,
        color: BODY_COLOR,
      });
      rowY -= 13;
      this.page.drawText(row.detail, {
        x: MARGIN_LEFT + 28,
        y: rowY,
        size: 9,
        font: this.font,
        color: MUTED_COLOR,
      });
      rowY -= 16;
    }
    return rowY;
  }

  private drawIncludedTreatmentRows(
    topY: number,
    startOffset: number,
    rows: Array<{ label: string; detail: string }>,
  ): void {
    let rowY = topY - startOffset;
    for (const row of rows) {
      this.page.drawText(`${row.label}: ${row.detail}`, {
        x: MARGIN_LEFT + 20,
        y: rowY,
        size: 9,
        font: this.font,
        color: BODY_COLOR,
      });
      rowY -= 18;
    }
  }

  drawQuarterlyIncludedHighlight(pricing: QuarterlyAgreementPricing): void {
    const boxHeight = 108;
    const topY = this.drawBox(boxHeight);

    this.drawCenteredAt("Included at No Additional Charge", topY - 22, {
      size: 11,
      bold: true,
    });
    this.drawCenteredAt(
      `${formatAgreementDollars(pricing.includedAnnualValue)}/year in premium treatments included with Quarterly`,
      topY - 40,
      { size: 9, color: MUTED_COLOR },
    );

    this.drawIncludedTreatmentRows(topY, 58, pricing.includedRows);

    this.y = topY - boxHeight - 12;
  }

  drawBiannualSavingsHighlight(pricing: BiannualAgreementPricing): void {
    const boxHeight = 150;
    const topY = this.drawBox(boxHeight);

    this.drawCenteredAt("Membership Savings", topY - 22, {
      size: 11,
      bold: true,
    });
    this.drawCenteredAt(
      "Compared to purchasing the same visits individually at one-time rates",
      topY - 38,
      { size: 9, color: MUTED_COLOR },
    );

    const afterMathY = this.drawMathBlock(topY, 54, [
      ...pricing.retailRows,
      pricing.membershipRow,
    ]);

    this.page.drawText("You Save", {
      x: MARGIN_LEFT + 20,
      y: afterMathY - 4,
      size: 10,
      font: this.fontBold,
      color: BODY_COLOR,
    });
    const saveText = formatAgreementDollars(pricing.youSave);
    const saveWidth = this.fontBold.widthOfTextAtSize(saveText, 12);
    this.page.drawText(saveText, {
      x: PDF_PAGE_SIZE[0] - MARGIN_RIGHT - 20 - saveWidth,
      y: afterMathY - 4,
      size: 12,
      font: this.fontBold,
      color: BODY_COLOR,
    });

    this.y = topY - boxHeight - 12;
  }

  reserveSignatureBlock(label: string): void {
    this.gap(16);
    this.ensureSpace(120);
    this.drawHeading(label);
    this.gap(72);
  }
}
