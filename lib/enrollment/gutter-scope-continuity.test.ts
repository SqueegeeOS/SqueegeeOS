import { describe, expect, it } from "vitest";
import { generateEnrollmentAgreementPreviewPDF } from "@/lib/agreement/generate-signed-pdf";
import { createDefaultPresentation } from "@/lib/presentations/repository";
import { computePresentationRates } from "@/lib/presentations/calculations";
import { createDefaultCarePlan } from "@/lib/presentations/care-plan";
import { buildPortalHomeCarePlanFromPresentation } from "@/lib/membership/portal-home-care-plan";
import { buildEnrollmentDocumentSnapshot, enrollmentScopePlainText } from "./document-snapshot";
import { buildPublicEnrollmentAgreementSummary } from "./public-agreement-summary";
import { enrollmentAgreementPdfInput } from "./agreement-pdf-input";

function gutterPresentation() {
  const presentation = createDefaultPresentation({ clientName: "Test Homeowner", tier: "biannual" });
  const plan = createDefaultCarePlan({ tier: "biannual", includeInterior: true, includeScreens: true });
  plan.summary = "Windows $300, gutter cleaning $150, solar panels $264 each visit. Twice yearly.";
  plan.servicePrices = { ...plan.servicePrices, interiorWindows: 0, screens: 0, solarPanels: 264, gutterCleaning: 150 };
  plan.visits = plan.visits.map((visit) => ({ ...visit, solarPanels: "included", gutterCleaning: "included", priceOverride: 714, notes: "Windows $300 (including interior and screens), gutters $150, solar panels $264. Total $714." }));
  return { ...presentation, clientEmail: "homeowner@example.com", clientAddress: "123 Test Street, Chico, CA", planMode: "custom" as const, carePlan: plan, monthlyRate: 300, overrideTier: "biannual" as const, visitRateOverrides: { biannual: 300 } };
}

function snapshot() {
  return buildEnrollmentDocumentSnapshot({ presentation: gutterPresentation(), tier: "biannual", firstVisitPrice: 714, recurringVisitPrice: 714, annualizedValue: 1428, salesContext: "remote", homeSolicitationNoticeDays: null, paymentRail: "stripe_card", createdAt: "2026-11-10T00:00:00.000Z" });
}

describe("gutter scope continuity", () => {
  it("renders the corrected plan in an unsigned review PDF", async () => {
    const input = enrollmentAgreementPdfInput(snapshot());
    const pdf = await generateEnrollmentAgreementPreviewPDF({ ...input, signedAt: "2026-11-10T00:00:00.000Z" });
    expect(pdf.byteLength).toBeGreaterThan(500);
    if (process.env.GUTTER_REVIEW_PDF === "1") {
      const { writeFileSync } = await import("node:fs");
      writeFileSync("/tmp/gutter-plan-preview.pdf", pdf);
    }
  });
  it("keeps the exact twice-yearly $714 plan in pricing, frozen agreement, signing summary, PDF input, and portal", () => {
    const presentation = gutterPresentation();
    const rates = computePresentationRates(presentation);
    expect(rates.carePlanPricing?.visits.map((visit) => visit.total)).toEqual([714, 714]);
    expect(rates.annualRate).toBe(1428);
    const frozen = snapshot();
    expect(frozen.plan.visits.map((visit) => visit.gutterCleaning)).toEqual(["included", "included"]);
    expect(frozen.plan.visits.map((visit) => visit.priceCents)).toEqual([71400, 71400]);
    expect(enrollmentScopePlainText(frozen).match(/Gutter cleaning: Included/g)).toHaveLength(2);
    const summary = buildPublicEnrollmentAgreementSummary(frozen, "stripe_card");
    expect(summary.visits.every((visit) => visit.includedServices.includes("Gutter cleaning"))).toBe(true);
    expect(summary.annualTotalCents).toBe(142800);
    const pdf = enrollmentAgreementPdfInput(frozen);
    expect(pdf.carePlan?.visits.every((visit) => visit.gutterCleaning === "included")).toBe(true);
    expect(pdf.carePlanPricing?.visits.map((visit) => visit.total)).toEqual([714, 714]);
    const portal = buildPortalHomeCarePlanFromPresentation({ presentation, homeownerSlug: "test", propertySlug: "test-home", planName: "Bi-Annual Care", agreementTier: "biannual", visitPrice: 714 });
    expect(JSON.stringify(portal)).toContain("gutter cleaning included");
    expect(JSON.stringify(portal)).toContain("gutters $150");
  });

  it("does not retroactively add gutters to legacy frozen packets or mutate them", () => {
    const legacy = snapshot();
    legacy.plan.visits.forEach((visit) => { delete visit.gutterCleaning; });
    const before = JSON.stringify(legacy);
    const pdf = enrollmentAgreementPdfInput(legacy);
    expect(pdf.carePlan?.visits.every((visit) => visit.gutterCleaning === "not_included")).toBe(true);
    const summary = buildPublicEnrollmentAgreementSummary(legacy, "stripe_card");
    expect(summary.visits.every((visit) => !visit.includedServices.includes("Gutter cleaning"))).toBe(true);
    expect(enrollmentScopePlainText(legacy)).not.toContain("Gutter cleaning:");
    expect(JSON.stringify(legacy)).toBe(before);
  });

  it("shows optional gutters separately and never adds them to included services", () => {
    const optional = snapshot();
    optional.plan.visits.forEach((visit) => { visit.gutterCleaning = "optional"; });
    const summary = buildPublicEnrollmentAgreementSummary(optional, "stripe_card");
    expect(summary.optionalAddOns).toContainEqual({ label: "Gutter cleaning", priceCents: null });
    expect(summary.visits.every((visit) => !visit.includedServices.includes("Gutter cleaning"))).toBe(true);
  });
});
