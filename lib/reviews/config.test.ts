import { describe, expect, it } from "vitest";
import { isLikelyGooglePlaceId } from "./config";

describe("Google reviews configuration", () => {
  it("accepts a public Google Place ID", () => {
    expect(isLikelyGooglePlaceId("ChIJQX_D76BQNSARonMZfaOHgKg")).toBe(true);
  });

  it("rejects credentials accidentally pasted into GOOGLE_PLACE_ID", () => {
    expect(isLikelyGooglePlaceId("AIza-not-a-place-id")).toBe(false);
    expect(isLikelyGooglePlaceId("ya29-not-a-place-id")).toBe(false);
    expect(isLikelyGooglePlaceId("https://maps.google.com/example")).toBe(false);
  });
});
