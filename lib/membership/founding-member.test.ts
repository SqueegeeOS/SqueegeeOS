import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatFoundingMemberLabel,
  isFoundingMembershipPeriod,
  resolveFoundingMemberFields,
} from "./founding-member";

describe("founding member", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("grants founding status during the open founding period", () => {
    vi.stubEnv("FOUNDING_PERIOD_END", "");
    const fields = resolveFoundingMemberFields("2026-07-07T12:00:00.000Z");
    expect(fields).toEqual({
      foundingMember: true,
      foundingMemberSince: "2026-07-07T12:00:00.000Z",
    });
  });

  it("denies founding status after the configured end date", () => {
    vi.stubEnv("FOUNDING_PERIOD_END", "2026-06-30T23:59:59.999Z");
    expect(
      isFoundingMembershipPeriod(new Date("2026-07-07T12:00:00.000Z")),
    ).toBe(false);
    expect(resolveFoundingMemberFields("2026-07-07T12:00:00.000Z")).toEqual({
      foundingMember: false,
      foundingMemberSince: null,
    });
  });

  it("formats the founding member display label", () => {
    expect(
      formatFoundingMemberLabel({
        foundingMember: true,
        memberSince: "2026-03-15T00:00:00.000Z",
      }),
    ).toBe("Founding Member · Member since 2026");
    expect(
      formatFoundingMemberLabel({
        foundingMember: false,
        memberSince: "2026-03-15T00:00:00.000Z",
      }),
    ).toBeNull();
  });
});
