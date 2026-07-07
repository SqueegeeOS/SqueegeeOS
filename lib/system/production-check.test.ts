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
});
