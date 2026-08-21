import { describe, expect, it } from "vitest";
import {
  buildBusinessPulseSnapshot,
  buildMonthlyPaidRevenue,
  resolveBusinessPulseRange,
  type BusinessPulseMembershipRow,
} from "./business-pulse";

const ACTIVE_MEMBERSHIP: BusinessPulseMembershipRow = {
  id: "membership-1",
  property_id: "property-1",
  agreement_id: "agreement-1",
  status: "active",
  annual_rate: 800,
  visit_price: 400,
  visits_per_year: 2,
  payment_setup_completed_at: "2026-08-01T12:00:00.000Z",
  stripe_payment_method_id: "pm_test",
  stripe_customer_id: "cus_test",
  payment_rail: "stripe_card",
  manual_payment_approved_at: null,
  manual_payment_approved_by: null,
};

describe("Business Pulse", () => {
  it("uses Pacific calendar boundaries for owner-facing periods", () => {
    const range = resolveBusinessPulseRange(
      "current_month",
      new Date("2026-08-20T18:00:00.000Z"),
    );
    expect(range.startCalendarDate).toBe("2026-08-01");
    expect(range.endCalendarDateExclusive).toBe("2026-09-01");
    expect(range.startUtc).toBe("2026-08-01T07:00:00.000Z");
  });

  it("deduplicates Jobber visits and never adds Stripe-backed collections twice", () => {
    const range = resolveBusinessPulseRange(
      "current_month",
      new Date("2026-08-20T18:00:00.000Z"),
    );
    const snapshot = buildBusinessPulseSnapshot({
      range,
      now: new Date("2026-08-20T18:00:00.000Z"),
      jobs: [
        {
          external_job_id: "job-member",
          external_property_id: "jobber-property-member",
          job_number: 101,
          title: "Window cleaning",
          client_name: "Member customer",
          scheduled_start: "2026-08-10T17:00:00.000Z",
          is_complete: true,
          job_total_cents: 40_000,
          visit_invoice_status: "paid",
          source_observed_at: "2026-08-10T18:00:00.000Z",
          updated_at: "2026-08-10T18:00:00.000Z",
        },
        {
          external_job_id: "job-member",
          external_property_id: "jobber-property-member",
          job_number: 101,
          title: "Window cleaning follow-up",
          client_name: "Member customer",
          scheduled_start: "2026-08-11T17:00:00.000Z",
          is_complete: true,
          job_total_cents: 40_000,
          visit_invoice_status: "paid",
          source_observed_at: "2026-08-11T18:00:00.000Z",
          updated_at: "2026-08-11T18:00:00.000Z",
        },
        {
          external_job_id: "job-unlinked",
          external_property_id: "jobber-property-unlinked",
          job_number: 102,
          title: "Solar cleaning",
          client_name: "Other customer",
          scheduled_start: "2026-08-12T17:00:00.000Z",
          is_complete: false,
          job_total_cents: 30_000,
          visit_invoice_status: "draft",
          source_observed_at: "2026-08-12T18:00:00.000Z",
          updated_at: "2026-08-12T18:00:00.000Z",
        },
      ],
      memberships: [ACTIVE_MEMBERSHIP],
      agreements: [
        {
          id: "agreement-1",
          membership_id: "membership-1",
          homeowner_name: "Member customer",
          signed_at: "2026-08-05T17:00:00.000Z",
        },
      ],
      propertyLinks: [
        {
          external_property_id: "jobber-property-member",
          membership_id: "membership-1",
          property_id: "property-1",
          link_state: "active",
        },
      ],
      billingCharges: [
        {
          status: "paid",
          amount: 400,
          amount_collected: 400,
          charged_at: "2026-08-10T19:00:00.000Z",
        },
      ],
      addons: [],
      leads: [
        { source: "website", submitted_at: "2026-08-04T17:00:00.000Z" },
        { source: "facebook_lead_ad", submitted_at: "2026-08-06T17:00:00.000Z" },
      ],
      jobberConnectionStatus: "connected",
      jobberLastSyncedAt: "2026-08-20T17:00:00.000Z",
      stripeConfigured: true,
      stripeLastEventAt: "2026-08-10T19:00:00.000Z",
      stripeProcessingErrors: 0,
      goHighLevelConfigured: false,
    });

    expect(snapshot.metrics.jobsBooked).toBe(2);
    expect(snapshot.metrics.paidWorkValueCents).toBe(40_000);
    expect(snapshot.metrics.membershipPaidWorkValueCents).toBe(40_000);
    expect(snapshot.metrics.homeAtlasMembershipCollectedCents).toBe(40_000);
    expect(snapshot.metrics.bookedWorkValueCents).toBe(70_000);
    expect(snapshot.metrics.activeArrCents).toBe(80_000);
    expect(snapshot.metrics.arrAddedCents).toBe(80_000);
    expect(snapshot.metrics.membershipsSold).toBe(1);
    expect(snapshot.metrics.leads).toBe(2);
    expect(snapshot.warnings[0]).toContain("not linked");
  });

  it("fills every month across all available revenue years and deduplicates jobs", () => {
    const monthly = buildMonthlyPaidRevenue(
      [
        {
          external_job_id: "historical-job",
          scheduled_start: "2024-06-24T17:00:00.000Z",
          job_total_cents: 20_000,
          visit_invoice_status: "paid",
        },
        {
          external_job_id: "historical-job",
          scheduled_start: "2024-06-25T17:00:00.000Z",
          job_total_cents: 20_000,
          visit_invoice_status: "paid",
        },
        {
          external_job_id: "unpaid-job",
          scheduled_start: "2025-01-10T18:00:00.000Z",
          job_total_cents: 30_000,
          visit_invoice_status: "draft",
        },
        {
          external_job_id: "current-job",
          scheduled_start: "2026-08-12T17:00:00.000Z",
          job_total_cents: 40_000,
          visit_invoice_status: "paid",
        },
        {
          external_job_id: "future-job",
          scheduled_start: "2026-10-12T17:00:00.000Z",
          job_total_cents: 50_000,
          visit_invoice_status: "paid",
        },
      ],
      new Date("2026-08-20T18:00:00.000Z"),
    );

    expect(monthly.years).toEqual([2024, 2025, 2026]);
    expect(monthly.points).toHaveLength(36);
    expect(monthly.earliestRecordedMonth).toBe("2024-06");
    expect(monthly.points.find((point) => point.monthKey === "2024-01")).toMatchObject({
      hasSourceCoverage: false,
    });
    expect(monthly.points.find((point) => point.monthKey === "2024-06")).toMatchObject({
      paidRevenueCents: 20_000,
      paidJobs: 1,
      hasSourceCoverage: true,
    });
    expect(monthly.points.find((point) => point.monthKey === "2024-07")).toMatchObject({
      paidRevenueCents: 0,
      paidJobs: 0,
    });
    expect(monthly.points.find((point) => point.monthKey === "2025-01")).toMatchObject({
      paidRevenueCents: 0,
      paidJobs: 0,
    });
    expect(monthly.points.find((point) => point.monthKey === "2026-08")).toMatchObject({
      paidRevenueCents: 40_000,
      paidJobs: 1,
    });
    expect(monthly.points.find((point) => point.monthKey === "2026-10")).toMatchObject({
      paidRevenueCents: 0,
      paidJobs: 0,
    });
  });
});
