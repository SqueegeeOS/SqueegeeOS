import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FOUNDING_MEMBER_STORY,
  formatFoundingMemberLabel,
  isFoundingMembershipPeriod,
  resolveFoundingMemberDisplay,
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

  it("warns once in production when FOUNDING_PERIOD_END is unset", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FOUNDING_PERIOD_END", "");

    isFoundingMembershipPeriod();
    isFoundingMembershipPeriod();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("FOUNDING_PERIOD_END is not set");
    warn.mockRestore();
  });

  it("resolves the founding member story display for portal UI", () => {
    expect(
      resolveFoundingMemberDisplay({
        foundingMember: true,
        memberSince: "2026-03-15T00:00:00.000Z",
      }),
    ).toEqual({
      title: "Founding Member",
      story: FOUNDING_MEMBER_STORY,
      memberSinceLine: "Member Since 2026",
    });
    expect(
      resolveFoundingMemberDisplay({
        foundingMember: false,
        memberSince: "2026-03-15T00:00:00.000Z",
      }),
    ).toBeNull();
  });

  it("keeps the compact legacy label format", () => {
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
