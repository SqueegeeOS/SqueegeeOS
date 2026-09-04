import { describe, expect, it } from "vitest";
import { formatJobberVisitAddress, jobDirectionsHref } from "./jobber-visit-address";

describe("exact Jobber visit navigation", () => {
  it("formats the structured address including apartment, region and postal code", () => {
    expect(formatJobberVisitAddress({ street1: " 123 Main St ", street2: "Unit 4", city: "Chico", province: "CA", postalCode: "95928", country: "US" }))
      .toBe("123 Main St, Unit 4, Chico, CA, 95928, US");
  });
  it("does not substitute a nickname, another property, or an ambiguous street", () => {
    for (const value of [null, "Riley residence", [], {}, { name: "Riley residence" }, { street1: "123 Main St" }, { city: "Chico" }, { street1: 123, city: "Chico" }]) {
      expect(formatJobberVisitAddress(value)).toBeNull();
    }
  });
  it("encodes the full destination in a fixed Google Maps directions URL", () => {
    const address = "123 Main St #4, Chico, CA & US";
    const url = new URL(jobDirectionsHref(address)!);
    expect(url.origin + url.pathname).toBe("https://www.google.com/maps/dir/");
    expect(url.searchParams.get("destination")).toBe(address);
    expect(url.searchParams.get("api")).toBe("1");
    expect(jobDirectionsHref(null)).toBeNull();
    expect(jobDirectionsHref(" ")).toBeNull();
  });
});
