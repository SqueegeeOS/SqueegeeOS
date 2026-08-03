import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  classifyJobberProperty,
  isActiveMembershipJobLink,
  isEligibleMemberProperty,
} from "./jobber-property-matching";

const activeMembership = {
  id: "membership-1",
  homeowner_id: "homeowner-1",
  property_id: "property-1",
  status: "active",
  payment_setup_completed_at: "2026-07-12T20:00:00.000Z",
  stripe_payment_method_id: "pm_test",
  stripe_customer_id: "cus_test",
  agreement_id: "agreement-1",
  sales_tier: "quarterly",
  visit_price: 225,
};

describe("supervised Jobber property classification", () => {
  it("treats every unlinked or revoked property as Jobber-only", () => {
    expect(classifyJobberProperty(null, false)).toBe("jobber_only");
    expect(classifyJobberProperty("revoked", true)).toBe("jobber_only");
  });

  it("recognizes a member property only through an active explicit link", () => {
    expect(classifyJobberProperty("active", true)).toBe(
      "homeatlas_member_property",
    );
    expect(classifyJobberProperty("active", false)).toBe("link_attention");
  });

  it("requires the canonical active membership and exact property owner", () => {
    expect(
      isEligibleMemberProperty(activeMembership, {
        id: "property-1",
        homeowner_id: "homeowner-1",
      }),
    ).toBe(true);
    expect(
      isEligibleMemberProperty(
        { ...activeMembership, status: "paused" },
        { id: "property-1", homeowner_id: "homeowner-1" },
      ),
    ).toBe(false);
    expect(
      isEligibleMemberProperty(activeMembership, {
        id: "property-1",
        homeowner_id: "someone-else",
      }),
    ).toBe(false);
  });

  it("requires an exact active property and job classification before billing eligibility", () => {
    const propertyLink = {
      membership_id: "membership-1",
      property_id: "property-1",
      link_state: "active" as const,
    };
    const jobLink = {
      membership_id: "membership-1",
      property_id: "property-1",
      external_property_id: "jobber-property-1",
      link_state: "active" as const,
    };

    expect(
      isActiveMembershipJobLink({
        jobLink,
        propertyLink,
        externalPropertyId: "jobber-property-1",
        membershipActive: true,
      }),
    ).toBe(true);
    expect(
      isActiveMembershipJobLink({
        jobLink: { ...jobLink, membership_id: "membership-2" },
        propertyLink,
        externalPropertyId: "jobber-property-1",
        membershipActive: true,
      }),
    ).toBe(false);
    expect(
      isActiveMembershipJobLink({
        jobLink,
        propertyLink: { ...propertyLink, link_state: "revoked" },
        externalPropertyId: "jobber-property-1",
        membershipActive: true,
      }),
    ).toBe(false);
    expect(
      isActiveMembershipJobLink({
        jobLink,
        propertyLink,
        externalPropertyId: "different-jobber-property",
        membershipActive: true,
      }),
    ).toBe(false);
  });

  it("keeps database guardrails explicit and append-only", () => {
    const sql = readFileSync(
      new URL(
        "../persistence/supabase/migrations/034_jobber_supervised_property_links.sql",
        import.meta.url,
      ),
      "utf8",
    );
    expect(sql).toContain("No row means Jobber-only");
    expect(sql).toContain("jobber_property_links_membership_property_fkey");
    expect(sql).toContain("strictly active HomeAtlas membership");
    expect(sql).toContain("must be revoked, never deleted");
    expect(sql).toContain("append-only and immutable");
    expect(sql).toContain(
      "alter table public.jobber_property_links enable row level security",
    );
  });

  it("projects only verified membership jobs and never creates a charge", () => {
    const service = readFileSync(
      new URL("./jobber-property-matching.ts", import.meta.url),
      "utf8",
    );
    expect(service).not.toContain('.from("obligations")');
    expect(service).not.toContain('.from("billing_orders")');
    expect(service).not.toContain('.from("membership_billing_charges")');
    expect(service).not.toMatch(/paymentIntents\.create|paymentIntents\.confirm/);
    expect(service).toContain('.from("jobber_membership_job_links")');
    expect(service).toContain("reconcileAllPairedCustomerPortalVisits");
    expect(service).not.toMatch(/\bmutation\b/i);
  });
});
