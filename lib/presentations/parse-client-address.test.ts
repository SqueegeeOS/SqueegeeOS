import { describe, expect, it } from "vitest";
import {
  firstNameFromFullName,
  hasCompleteClientAddress,
  parseClientAddress,
} from "./parse-client-address";

describe("parseClientAddress", () => {
  it("parses street, city, state zip", () => {
    expect(
      parseClientAddress("742 Evergreen Terrace, Springfield, IL 62704"),
    ).toEqual({
      address: "742 Evergreen Terrace",
      city: "Springfield",
      state: "IL",
      zip: "62704",
      propertyName: "742 Evergreen Terrace",
    });
  });

  it("uses fallback when state/zip missing", () => {
    expect(parseClientAddress("123 Main St", "Lake House")).toEqual({
      address: "123 Main St",
      city: "",
      state: "",
      zip: "",
      propertyName: "Lake House",
    });
  });

  it("handles empty address", () => {
    expect(parseClientAddress("", "Client Home")).toEqual({
      address: "Client Home",
      city: "",
      state: "",
      zip: "",
      propertyName: "Client Home",
    });
  });

  it.each([
    "742 Evergreen Terrace, Springfield, IL 62704-1234",
    "742 Evergreen Terrace, Springfield, IL 62704 1234",
    "742 Evergreen Terrace, Springfield, IL 62704–1234",
    "742 Evergreen Terrace, Springfield, IL 62704‑1234",
  ])("accepts and canonicalizes ZIP+4 separators: %s", (raw) => {
    const parsed = parseClientAddress(raw);
    expect(parsed.zip).toBe("62704-1234");
    expect(hasCompleteClientAddress(parsed)).toBe(true);
  });

  it("distinguishes complete addresses from partial free text", () => {
    expect(
      hasCompleteClientAddress(
        parseClientAddress("742 Evergreen Terrace, Springfield, IL 62704"),
      ),
    ).toBe(true);
    expect(hasCompleteClientAddress(parseClientAddress("123 Main St"))).toBe(
      false,
    );
  });
});

describe("firstNameFromFullName", () => {
  it("returns first token", () => {
    expect(firstNameFromFullName("Jane Q. Public")).toBe("Jane");
  });

  it("falls back for blank", () => {
    expect(firstNameFromFullName("  ")).toBe("Member");
  });
});
