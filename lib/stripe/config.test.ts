import { afterEach, describe, expect, it } from "vitest";
import { isStripeServerEnabled } from "./config";

const originalSecret = process.env.STRIPE_SECRET_KEY;
const originalPublishable = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = originalSecret;
  if (originalPublishable === undefined) {
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  } else {
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = originalPublishable;
  }
});

describe("isStripeServerEnabled", () => {
  it("requires a complete same-mode key pair", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_server";
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_browser";
    expect(isStripeServerEnabled()).toBe(true);

    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_live_browser";
    expect(isStripeServerEnabled()).toBe(false);

    delete process.env.STRIPE_SECRET_KEY;
    expect(isStripeServerEnabled()).toBe(false);
  });
});
