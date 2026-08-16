import { describe, expect, it } from "vitest";
import {
  jobberHandoffHref,
  resolveJobberHandoffFocus,
} from "./jobber-handoff-navigation";

const MEMBERSHIP_ID = "15b81d70-aff4-40c5-a0fc-a74b915023c7";

describe("member-specific Jobber handoff navigation", () => {
  it("keeps only the opaque membership id and required step in the URL", () => {
    expect(jobberHandoffHref(MEMBERSHIP_ID, "property")).toBe(
      `/hq/jobber?membership=${MEMBERSHIP_ID}&step=property#jobber-visits`,
    );
  });

  it("accepts only a real membership id and known supervised step", () => {
    expect(
      resolveJobberHandoffFocus({
        membership: MEMBERSHIP_ID,
        step: "job",
      }),
    ).toEqual({ membershipId: MEMBERSHIP_ID, step: "job" });
    expect(
      resolveJobberHandoffFocus({ membership: "not-an-id", step: "job" }),
    ).toBeNull();
    expect(
      resolveJobberHandoffFocus({
        membership: MEMBERSHIP_ID,
        step: "automatic",
      }),
    ).toBeNull();
  });
});
