import { describe, expect, it } from "vitest";
import { isAtlasThemeId } from "@/lib/theme/atlas-themes";
import {
  portalThemeStorageKey,
  resolvePortalThemePreference,
} from "@/lib/theme/portal-theme-persistence";

describe("isAtlasThemeId", () => {
  it("accepts day, night, and lux", () => {
    expect(isAtlasThemeId("day")).toBe(true);
    expect(isAtlasThemeId("night")).toBe(true);
    expect(isAtlasThemeId("lux")).toBe(true);
  });

  it("rejects unknown values", () => {
    expect(isAtlasThemeId("dawn")).toBe(false);
    expect(isAtlasThemeId(null)).toBe(false);
    expect(isAtlasThemeId("")).toBe(false);
  });
});

describe("portal theme persistence", () => {
  it("scopes localStorage keys by membership", () => {
    expect(portalThemeStorageKey("abc-123")).toBe(
      "homeatlas-portal-theme:abc-123",
    );
    expect(portalThemeStorageKey(null)).toBe("homeatlas-portal-theme");
  });

  it("prefers server theme over default", () => {
    expect(resolvePortalThemePreference("day", "member-1")).toBe("day");
  });

  it("falls back to night when nothing is saved", () => {
    expect(resolvePortalThemePreference(null, null)).toBe("night");
    expect(resolvePortalThemePreference("invalid", null)).toBe("night");
  });
});
