import { describe, expect, it } from "vitest";
import {
  formatPortalPropertyAddress,
  isPortalAddressPlaceholder,
} from "./portal-address";

describe("formatPortalPropertyAddress", () => {
  it("shows only the street when city is TBD", () => {
    expect(
      formatPortalPropertyAddress({
        address: "366 brookside Drive",
        city: "TBD",
        state: "CA",
      }),
    ).toBe("366 Brookside Drive");
  });

  it("shows full locality when city and state are present", () => {
    expect(
      formatPortalPropertyAddress({
        address: "4125 Canyon Oaks Drive",
        city: "Chico",
        state: "ca",
        zip: "95928",
      }),
    ).toBe("4125 Canyon Oaks Drive, Chico, CA 95928");
  });

  it("strips TBD embedded in the street address field", () => {
    expect(
      formatPortalPropertyAddress({
        address: "366 brookside Drive, TBD",
        city: "TBD",
        state: "CA",
      }),
    ).toBe("366 Brookside Drive");
  });

  it("strips literal null and undefined strings", () => {
    expect(
      formatPortalPropertyAddress({
        address: "366 Brookside Drive, null",
        city: "undefined",
      }),
    ).toBe("366 Brookside Drive");
  });

  it("omits empty and placeholder parts", () => {
    expect(
      formatPortalPropertyAddress({
        address: "  ",
        city: "null",
        state: "undefined",
      }),
    ).toBe("");
  });
});

describe("isPortalAddressPlaceholder", () => {
  it("flags common placeholder values", () => {
    expect(isPortalAddressPlaceholder("TBD")).toBe(true);
    expect(isPortalAddressPlaceholder("n/a")).toBe(true);
    expect(isPortalAddressPlaceholder("Chico")).toBe(false);
  });
});
