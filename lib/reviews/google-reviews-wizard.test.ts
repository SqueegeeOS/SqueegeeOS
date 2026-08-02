import { describe, expect, it } from "vitest";
import {
  DEFAULT_WIZARD_STATE,
  wizardStateForStorage,
} from "./google-reviews-wizard";

describe("Google reviews wizard storage", () => {
  it("never persists the server API key in browser storage", () => {
    const stored = wizardStateForStorage({
      ...DEFAULT_WIZARD_STATE,
      apiKey: "sensitive-key",
      placeId: "ChIJ-public-place-id",
    });

    expect(stored.apiKey).toBe("");
    expect(stored.placeId).toBe("ChIJ-public-place-id");
  });
});
