import { describe, expect, it } from "vitest";
import {
  formatAddressSuggestionFallback,
  formatUsPropertyAddress,
} from "./us-property-address";

describe("US property address continuity", () => {
  it("formats one compact identity for field capture and presentations", () => {
    expect(
      formatUsPropertyAddress({
        street: "  1420   Davis St ",
        city: " Chico ",
        state: " ca ",
        zip: "95928",
      }),
    ).toBe("1420 Davis St, Chico, CA 95928");
  });

  it("keeps partial manual entry valid and removes only a country suffix", () => {
    expect(
      formatUsPropertyAddress({
        street: "77 Oak Avenue",
        city: "",
        state: "",
        zip: "",
      }),
    ).toBe("77 Oak Avenue");
    expect(
      formatAddressSuggestionFallback(
        "1420 Davis Street, Chico, CA, United States",
      ),
    ).toBe("1420 Davis Street, Chico, CA");
  });
});
