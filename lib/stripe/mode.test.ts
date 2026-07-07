import { describe, expect, it } from "vitest";
import { isStripeLiveMode, resolveStripeKeyMode } from "./mode";

describe("resolveStripeKeyMode", () => {
  it("returns live when both keys are live-mode", () => {
    expect(
      resolveStripeKeyMode("sk_live_abc", "pk_live_xyz"),
    ).toBe("live");
    expect(isStripeLiveMode("sk_live_abc", "pk_live_xyz")).toBe(true);
  });

  it("returns test when both keys are test-mode", () => {
    expect(
      resolveStripeKeyMode("sk_test_abc", "pk_test_xyz"),
    ).toBe("test");
    expect(isStripeLiveMode("sk_test_abc", "pk_test_xyz")).toBe(false);
  });

  it("returns mismatch when key modes differ", () => {
    expect(
      resolveStripeKeyMode("sk_live_abc", "pk_test_xyz"),
    ).toBe("mismatch");
  });

  it("returns missing when a key is absent", () => {
    expect(resolveStripeKeyMode(undefined, "pk_live_xyz")).toBe("missing");
  });
});
