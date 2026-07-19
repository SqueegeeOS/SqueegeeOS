import { describe, expect, it } from "vitest";
import { getNavigationMode, shouldUseOverlayNav } from "./resolve";

describe("getNavigationMode", () => {
  it("keeps the day experience and its descendants hidden", () => {
    expect(getNavigationMode("/day")).toBe("hidden");
    expect(getNavigationMode("/day/guide")).toBe("hidden");
  });

  it("uses segment-aware matching for the day and night routes", () => {
    expect(getNavigationMode("/day2")).toBe("customer");
    expect(getNavigationMode("/night2")).toBe("customer");
    expect(getNavigationMode("/night")).toBe("hidden");
    expect(getNavigationMode("/night/guide")).toBe("hidden");
  });

  it("keeps existing employee prefix behavior", () => {
    expect(getNavigationMode("/employee")).toBe("employee");
    expect(getNavigationMode("/employee/requests")).toBe("employee");
  });
});

describe("shouldUseOverlayNav", () => {
  it("uses overlay navigation on both homepage experiences", () => {
    expect(shouldUseOverlayNav("/")).toBe(true);
    expect(shouldUseOverlayNav("/night2")).toBe(true);
  });
});
