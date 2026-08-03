import { describe, expect, it } from "vitest";
import { jobberScheduledChargeDecision } from "./jobber-scheduled-charge";

const base = {
  externalJobId: "job_1",
  externalVisitId: "visit_1",
  jobType: "RECURRING",
  billingType: "PER_VISIT",
  jobTotalCents: 27500,
  jobWillAutoCharge: false,
  visitInvoiceId: null,
  visitInvoiceStatus: "NONE",
  isLastScheduledVisit: false,
  isFirstVisitForJobInServiceMonth: true,
  serviceMonth: "2026-09-01",
};

describe("jobberScheduledChargeDecision", () => {
  it("bills each recurring per-visit job from the Jobber total", () => {
    expect(jobberScheduledChargeDecision(base)).toMatchObject({
      eligible: true,
      amountCents: 27500,
      chargeKind: "recurring_per_visit",
      billingUnitKey: "visit:visit_1",
    });
  });

  it("bills a fixed-price recurring job only once per service month", () => {
    expect(
      jobberScheduledChargeDecision({
        ...base,
        billingType: "FIXED_PRICE",
      }),
    ).toMatchObject({
      eligible: true,
      chargeKind: "recurring_fixed_price",
      billingUnitKey: "job:job_1:month:2026-09-01",
    });
    expect(
      jobberScheduledChargeDecision({
        ...base,
        billingType: "FIXED_PRICE",
        isFirstVisitForJobInServiceMonth: false,
      }).blockers,
    ).toContain("fixed_price_job_already_represented_this_month");
  });

  it("bills a one-off job on its last scheduled visit only", () => {
    const waiting = jobberScheduledChargeDecision({
      ...base,
      jobType: "ONE_OFF",
      billingType: "FIXED_PRICE",
    });
    expect(waiting.blockers).toContain("one_off_job_waiting_for_last_visit");
    expect(
      jobberScheduledChargeDecision({
        ...base,
        jobType: "ONE_OFF",
        billingType: "FIXED_PRICE",
        isLastScheduledVisit: true,
      }),
    ).toMatchObject({
      eligible: true,
      chargeKind: "one_off_job",
      billingUnitKey: "job:job_1",
    });
  });

  it("fails closed when Jobber can also charge or already invoiced the visit", () => {
    expect(
      jobberScheduledChargeDecision({
        ...base,
        jobWillAutoCharge: true,
        visitInvoiceId: "invoice_1",
        visitInvoiceStatus: "DRAFT",
      }).blockers,
    ).toEqual(
      expect.arrayContaining([
        "jobber_automatic_payment_enabled",
        "jobber_visit_already_invoiced",
      ]),
    );
  });

  it("fails closed when invoice visibility is missing or permission-hidden", () => {
    expect(
      jobberScheduledChargeDecision({
        ...base,
        visitInvoiceStatus: null,
      }).blockers,
    ).toContain("jobber_invoice_state_unknown");
    expect(
      jobberScheduledChargeDecision({
        ...base,
        visitInvoiceStatus: "PERMISSION_HIDDEN",
      }).blockers,
    ).toContain("jobber_invoice_visibility_unavailable");
  });
});
