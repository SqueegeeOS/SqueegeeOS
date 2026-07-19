import { describe, expect, it } from "vitest";
import { getNavigationMode } from "./resolve";

describe("getNavigationMode", () => {
  it("keeps the day experience and its descendants hidden", () => {
    expect(getNavigationMode("/day")).toBe("hidden");
    expect(getNavigationMode("/day/guide")).toBe("hidden");
  });

  it("does not hide the separate day2 staging route", () => {
    expect(getNavigationMode("/day2")).toBe("customer");
  });

  it("keeps existing employee prefix behavior", () => {
    expect(getNavigationMode("/employee")).toBe("employee");
    expect(getNavigationMode("/employee/requests")).toBe("employee");
  });
});
