import { describe, expect, it } from "vitest";
import { buildMembershipObligationWindows } from "./build-membership-obligation-windows";

describe("buildMembershipObligationWindows", () => {
  it("creates four quarterly windows from membership start", () => {
    const windows = buildMembershipObligationWindows(4, "2026-07-07T12:00:00.000Z");

    expect(windows).toHaveLength(4);
    expect(windows[0]).toMatchObject({
      sequence: 1,
      membershipYear: 1,
      targetWindowStart: "2026-07-07",
      targetWindowEnd: "2026-10-06",
    });
    expect(windows[3]?.targetWindowStart).toBe("2027-04-07");
    expect(windows[3]?.targetWindowEnd).toBe("2027-07-06");
  });

  it("creates two bi-annual windows from membership start", () => {
    const windows = buildMembershipObligationWindows(2, "2026-01-15T00:00:00.000Z");

    expect(windows).toHaveLength(2);
    expect(windows[0]).toMatchObject({
      sequence: 1,
      targetWindowStart: "2026-01-15",
      targetWindowEnd: "2026-07-14",
    });
    expect(windows[1]).toMatchObject({
      sequence: 2,
      targetWindowStart: "2026-07-15",
      targetWindowEnd: "2027-01-14",
    });
  });

  it("returns no windows for invalid visit counts", () => {
    expect(buildMembershipObligationWindows(0, "2026-01-01T00:00:00.000Z")).toEqual(
      [],
    );
    expect(
      buildMembershipObligationWindows(4, "not-a-date"),
    ).toEqual([]);
  });
});
