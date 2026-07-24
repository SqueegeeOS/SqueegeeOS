import { afterEach, describe, expect, it, vi } from "vitest";
import { startPortalTiming } from "./portal-timing";

describe("portal timing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs only allowlisted redacted fields", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_037);

    startPortalTiming("portal-page-load").finish("success");

    expect(info).toHaveBeenCalledWith("[portal-timing]", {
      operation: "portal-page-load",
      outcome: "success",
      durationMs: 37,
    });
    expect(Object.keys(info.mock.calls[0]?.[1] as object).sort()).toEqual([
      "durationMs",
      "operation",
      "outcome",
    ]);
  });

  it("rejects unknown labels without echoing sensitive input", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const sensitive = "portal-token-homeowner-slug-customer-address";

    expect(() =>
      startPortalTiming(sensitive as never),
    ).toThrow("Unsupported portal timing operation");
    expect(info).not.toHaveBeenCalled();
  });

  it("finishes once", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(Date, "now").mockReturnValue(2_000);
    const timing = startPortalTiming("portal-token-access");

    timing.finish("not-found");
    timing.finish("error");

    expect(info).toHaveBeenCalledTimes(1);
  });
});
