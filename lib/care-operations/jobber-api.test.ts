import { afterEach, describe, expect, it, vi } from "vitest";
import { exchangeJobberAuthorizationCode } from "./jobber-api";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Jobber OAuth token errors", () => {
  it("surfaces only a safe provider error code", async () => {
    vi.stubEnv("JOBBER_CLIENT_ID", "client-id");
    vi.stubEnv("JOBBER_CLIENT_SECRET", "client-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: "invalid_client",
            error_description: "provider detail that must stay private",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(
      exchangeJobberAuthorizationCode(
        "authorization-code",
        "https://app.example.com/jobber/callback",
      ),
    ).rejects.toThrow("Jobber token request failed (401: invalid_client)");
  });

  it("does not include malformed provider details in the error", async () => {
    vi.stubEnv("JOBBER_CLIENT_ID", "client-id");
    vi.stubEnv("JOBBER_CLIENT_SECRET", "client-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "invalid client: leaked detail" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(
      exchangeJobberAuthorizationCode(
        "authorization-code",
        "https://app.example.com/jobber/callback",
      ),
    ).rejects.toThrow("Jobber token request failed (401)");
  });
});
