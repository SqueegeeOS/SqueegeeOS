import { describe, expect, it } from "vitest";
import {
  jobberHandoffHref,
  jobberHandoffResumeHref,
  jobberTodayPairingHref,
  resolveJobberHandoffResumePath,
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
    ).toEqual({
      membershipId: MEMBERSHIP_ID,
      projectionId: null,
      step: "job",
      returnTo: null,
    });
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

  it("carries one exact Today visit into supervised pairing and back", () => {
    const href = jobberTodayPairingHref(MEMBERSHIP_ID);
    expect(href).toBe(
      `/hq/jobber?projection=${MEMBERSHIP_ID}&step=property&returnTo=%2Fhq%2Ftoday%23visit-${MEMBERSHIP_ID}#jobber-visit-${MEMBERSHIP_ID}`,
    );
    const parsed = new URL(href, "https://example.com");
    const focus = resolveJobberHandoffFocus({
      projection: parsed.searchParams.get("projection") ?? undefined,
      step: parsed.searchParams.get("step") ?? undefined,
      returnTo: parsed.searchParams.get("returnTo") ?? undefined,
    });
    expect(focus).toEqual({
      membershipId: null,
      projectionId: MEMBERSHIP_ID,
      step: "property",
      returnTo: `/hq/today#visit-${MEMBERSHIP_ID}`,
    });
    expect(focus && jobberHandoffResumeHref(focus)).toBe(href);
  });

  it("rejects unsafe return and OAuth resume paths", () => {
    expect(
      resolveJobberHandoffFocus({
        projection: MEMBERSHIP_ID,
        step: "property",
        returnTo: "https://evil.example/hq/today#visit-1",
      }),
    ).toEqual({
      membershipId: null,
      projectionId: MEMBERSHIP_ID,
      step: "property",
      returnTo: "/hq/today",
    });
    expect(resolveJobberHandoffResumePath("https://evil.example/hq/jobber"))
      .toBeNull();
    expect(resolveJobberHandoffResumePath("/hq/jobber?step=automatic"))
      .toBeNull();
    expect(resolveJobberHandoffResumePath(jobberTodayPairingHref(MEMBERSHIP_ID)))
      .toBe(jobberTodayPairingHref(MEMBERSHIP_ID));
  });
});
