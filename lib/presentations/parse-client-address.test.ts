import { describe, expect, it } from "vitest";
import {
  firstNameFromFullName,
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
      city: "TBD",
      state: "CA",
      zip: "",
      propertyName: "Lake House",
    });
  });

  it("handles empty address", () => {
    expect(parseClientAddress("", "Client Home")).toEqual({
      address: "Client Home",
      city: "TBD",
      state: "CA",
      zip: "",
      propertyName: "Client Home",
    });
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
