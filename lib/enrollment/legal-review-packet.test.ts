import { describe, expect, it } from "vitest";
import { getEnrollmentLegalReviewPacket } from "./legal-review-packet";

describe("enrollment legal review packet", () => {
  it("keeps the durable MSA separate from the property-specific deal", () => {
    const packet = getEnrollmentLegalReviewPacket();
    const msa = packet.documents.find(
      (document) => document.id === "master_service_agreement",
    );
    const propertyAgreement = packet.documents.find(
      (document) => document.id === "service_quote_agreement",
    );

    expect(msa?.purpose).toContain("durable relationship");
    expect(propertyAgreement?.purpose).toContain("deal sheet");
    expect(propertyAgreement?.sections.some((section) =>
      section.paragraphs.some((paragraph) =>
        paragraph.includes("public website estimate remains exterior-only"),
      ),
    )).toBe(true);
  });

  it("keeps signing, payment setup, and portal activation in a safe order", () => {
    const packet = getEnrollmentLegalReviewPacket();
    expect(packet.customerJourney.map((step) => step.title)).toEqual([
      "HomeAtlas freezes the accepted deal",
      "DocuSign emails one clear envelope",
      "HomeAtlas verifies and stores the evidence",
      "Stripe receives the card directly",
      "The private home portal turns on",
    ]);
    expect(packet.operatingRules).toContain(
      "Never collect a card before the customer completes the agreement.",
    );
  });

  it("exposes a complete business draft without turning it into an approved document", () => {
    const packet = getEnrollmentLegalReviewPacket();
    const msa = packet.documents.find(
      (document) => document.id === "master_service_agreement",
    );
    const propertyAgreement = packet.documents.find(
      (document) => document.id === "service_quote_agreement",
    );
    const allMsaCopy = msa?.sections.flatMap((section) => section.paragraphs).join(" ");
    const allPropertyCopy = propertyAgreement?.sections
      .flatMap((section) => section.paragraphs)
      .join(" ");

    expect(msa?.status).toBe("working_draft");
    expect(propertyAgreement?.status).toBe("working_draft");
    expect(allMsaCopy).toContain("does not require private arbitration");
    expect(allPropertyCopy).toContain("cash/check account");
    expect(allPropertyCopy).toContain("does not silently become part of future visits");
    expect(packet.sourceLinks.some((source) => source.label.includes("§ 1671"))).toBe(
      true,
    );
  });

  it("does not present the statutory customer-home insert as finished text", () => {
    const packet = getEnrollmentLegalReviewPacket();
    const notice = packet.documents.find(
      (document) => document.id === "customer_home_cancellation_notice",
    );
    expect(notice?.status).toBe("lawyer_text_required");
    expect(notice?.reviewFocus.join(" ")).toContain("Exact notice wording");
  });
});
