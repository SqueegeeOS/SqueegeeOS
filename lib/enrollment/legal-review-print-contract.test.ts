import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const page = read("../../app/hq/enrollment/review/page.tsx");
const reviewComponent = read(
  "../../components/admin/enrollment-legal-review-page.tsx",
);
const printButton = read(
  "../../components/admin/enrollment-review-print-button.tsx",
);
const enrollmentDesk = read("../../components/admin/enrollment-desk-page.tsx");
const packet = read("./legal-review-packet.ts");
const proxy = read("../../proxy.ts");

describe("printable enrollment release packet", () => {
  it("renders the same packet source behind the server-enforced HQ boundary", () => {
    expect(page).toContain("getEnrollmentLegalReviewPacket");
    expect(page).toContain("EnrollmentLegalReviewPage");
    expect(proxy).toContain('"/hq/:path+"');
    expect(reviewComponent).not.toContain('"use client"');
    expect(enrollmentDesk).toContain('/hq/enrollment/review');
  });

  it("stays visibly unreleased and exports through the browser print dialog", () => {
    expect(reviewComponent).toContain("Not yet owner-released to customers");
    expect(reviewComponent).toContain("Statutory source check");
    expect(reviewComponent).toContain("Packet fingerprint");
    expect(reviewComponent).toContain("Review-copy SHA-256");
    expect(reviewComponent).toContain("does not release a legal version");
    expect(printButton).toContain("window.print()");
    expect(printButton).toContain("Print / Save PDF");
  });

  it("links the controlling California issues without adding a send path", () => {
    for (const section of ["17602", "1689.5", "1689.7", "1633.7", "1671"]) {
      expect(packet).toContain(`sectionNum=${section}`);
    }
    expect(reviewComponent).not.toMatch(
      /sendCommunication|createCheckoutSession|createDocuSignEnvelope|fetch\(/,
    );
  });

  it("keeps the review-copy and released-document hashes visibly separate", () => {
    expect(enrollmentDesk).toContain("Review-copy fingerprint");
    expect(enrollmentDesk).toContain("Released-document hash");
    expect(enrollmentDesk).toContain(
      "does not approve the document or claim that DocuSign has",
    );
    expect(enrollmentDesk).toContain("the same bytes.");
  });
});
