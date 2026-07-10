import { describe, expect, it, vi } from "vitest";
import { logProtectedQueryResult } from "./rls-query-log";

describe("logProtectedQueryResult", () => {
  it("logs zero-row protected reads without customer payloads", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    logProtectedQueryResult(
      {
        surface: "member-portal.appointments",
        table: "member_appointments",
        membershipId: "membership-1",
        propertyId: "property-1",
      },
      { count: 0 },
    );

    expect(warn).toHaveBeenCalledOnce();
    const payload = warn.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload.surface).toBe("member-portal.appointments");
    expect(payload.resultCount).toBe(0);
    expect(payload.membershipId).toBe("membership-1");
    expect(payload).not.toHaveProperty("customerName");

    warn.mockRestore();
  });

  it("logs query errors with safe metadata", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logProtectedQueryResult(
      {
        surface: "member-portal.addons",
        table: "member_addon_transactions",
        membershipId: "membership-1",
      },
      { count: 0, error: { message: "permission denied", code: "42501" } },
    );

    expect(errorSpy).toHaveBeenCalledOnce();
    const payload = errorSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload.errorCode).toBe("42501");
    expect(payload.errorMessage).toBe("permission denied");

    errorSpy.mockRestore();
  });
});
