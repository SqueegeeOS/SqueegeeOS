import { afterEach, describe, expect, it, vi } from "vitest";

describe("createServerSupabaseClient", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("uses service role when SUPABASE_SERVICE_ROLE_KEY is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-example");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    vi.resetModules();

    const { createServerSupabaseClient } = await import("./client");
    const client = createServerSupabaseClient();
    expect(client.supabaseKey).toBe("service-role-key");
  });

  it("falls back to anon when service role is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-example");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.resetModules();

    const { createServerSupabaseClient, isServiceRoleConfigured } = await import("./client");
    const client = createServerSupabaseClient();
    expect(isServiceRoleConfigured()).toBe(false);
    expect(client.supabaseKey).toBe("anon-key-example");
  });
});
