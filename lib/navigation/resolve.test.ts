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

  it("lets dedicated field workspaces own their phone chrome", () => {
    expect(getNavigationMode("/david")).toBe("hidden");
    expect(getNavigationMode("/sales/alex")).toBe("hidden");
    expect(getNavigationMode("/tech")).toBe("hidden");
    expect(getNavigationMode("/tech/properties")).toBe("hidden");
  });

  it("lets Atlas own the promoted homepage chrome", () => {
    expect(getNavigationMode("/")).toBe("hidden");
    expect(getNavigationMode("/atlas-glass")).toBe("hidden");
    expect(getNavigationMode("/rightway")).toBe("customer");
  });
});

describe("shouldUseOverlayNav", () => {
  it("preserves overlay behavior for comparison experiences", () => {
    expect(shouldUseOverlayNav("/")).toBe(true);
    expect(shouldUseOverlayNav("/rightway")).toBe(true);
    expect(shouldUseOverlayNav("/night2")).toBe(true);
  });
});
