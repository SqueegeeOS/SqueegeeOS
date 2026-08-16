import { describe, expect, it } from "vitest";
import {
  billingMembershipAnchorId,
  billingTodayReviewHref,
  resolveBillingWorkspaceFocus,
} from "./billing-workspace-links";

const MEMBERSHIP_ID = "15b81d70-aff4-40c5-a0fc-a74b915023c7";
const APPOINTMENT_ID = "655a620d-59b2-4388-a66a-fe08dafc3b1a";
const PROJECTION_ID = "e52f67b3-4c86-4d3f-9606-45931be2b0ea";

describe("billing workspace links", () => {
  it("creates bounded URL-safe membership anchors", () => {
    expect(billingMembershipAnchorId(" membership/0406 ")).toBe(
      "billing-membership-0406",
    );
    expect(billingMembershipAnchorId("***")).toBe("billing-unknown");
    expect(billingMembershipAnchorId("a".repeat(250))).toHaveLength(
      "billing-".length + 180,
    );
  });

  it("carries one exact Today appointment into a read-only billing review", () => {
    const href = billingTodayReviewHref({
      membershipId: MEMBERSHIP_ID,
      appointmentId: APPOINTMENT_ID,
      projectionId: PROJECTION_ID,
    });
    expect(href).toBe(
      `/hq/billing?membership=${MEMBERSHIP_ID}&appointment=${APPOINTMENT_ID}&returnTo=%2Fhq%2Ftoday%23visit-${PROJECTION_ID}#billing-payment-review`,
    );

    const parsed = new URL(href, "https://example.com");
    expect(
      resolveBillingWorkspaceFocus({
        membership: parsed.searchParams.get("membership") ?? undefined,
        appointment: parsed.searchParams.get("appointment") ?? undefined,
        returnTo: parsed.searchParams.get("returnTo") ?? undefined,
      }),
    ).toEqual({
      membershipId: MEMBERSHIP_ID,
      appointmentId: APPOINTMENT_ID,
      returnTo: `/hq/today#visit-${PROJECTION_ID}`,
    });
  });

  it("rejects invented record ids and external return paths", () => {
    expect(
      resolveBillingWorkspaceFocus({
        membership: "membership-1",
        appointment: APPOINTMENT_ID,
      }),
    ).toBeNull();
    expect(
      resolveBillingWorkspaceFocus({
        membership: MEMBERSHIP_ID,
        appointment: APPOINTMENT_ID,
        returnTo: "https://evil.example/hq/today#visit-1",
      }),
    ).toEqual({
      membershipId: MEMBERSHIP_ID,
      appointmentId: APPOINTMENT_ID,
      returnTo: "/hq/today",
    });
  });
});
