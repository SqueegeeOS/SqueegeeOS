import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { runProductionCheck } from "./production-check";

describe("runProductionCheck", () => {
  const env = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...env };
  });

  afterEach(() => {
    process.env = env;
  });

  it("returns development mode when cloud persistence is off", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_ENABLED = "false";
    delete process.env.RESEND_API_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    const result = await runProductionCheck();
    expect(result.mode).toBe("development");
    expect(result.persistence).toBe(false);
  });

  it("flags missing resend when api key unset", async () => {
    delete process.env.RESEND_API_KEY;
    process.env.RESEND_AGREEMENT_FROM = "Test <a@b.com>";

    const result = await runProductionCheck();
    expect(result.resend).toBe(false);
    expect(result.details.resend.apiKey).toBe(false);
  });

  it("does not report production mode when Stripe test keys are configured", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_ENABLED = "true";
    process.env.NEXT_PUBLIC_PERSISTENCE_BACKEND = "supabase";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_AGREEMENT_FROM = "care@example.com";
    process.env.STRIPE_SECRET_KEY = "sk_test_abc";
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_xyz";

    const result = await runProductionCheck();
    expect(result.stripe).toBe(true);
    expect(result.stripeLive).toBe(false);
    expect(result.details.stripe.keyMode).toBe("test");
    expect(result.mode).not.toBe("production");
  });
});
