import { afterEach, describe, expect, it, vi } from "vitest";
import { exchangeJobberAuthorizationCode, fetchJobberClientPage } from "./jobber-api";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Jobber client phone synchronization", () => {
  const phone = "5305550101";
  const phones = [{ number: phone, primary: true }, { number: "5305550102", primary: false }];
  const page = { nodes: [{ id: "client-1", phone, phones }], pageInfo: { endCursor: null, hasNextPage: false } };
  const query = (call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string).query;

  it("reads primary and additional phone numbers without changing client/property identity", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ data: { clients: page } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchJobberClientPage("test-token", { addressFields: ["street"] })).resolves.toEqual(page);
    expect(query(fetchMock.mock.calls[0])).toContain("phones { number primary }");
    expect(query(fetchMock.mock.calls[0])).toContain("address { street }");
  });

  it("falls back to the legacy primary scalar if the provider hides the optional phone list", async () => {
    const legacy = { ...page, nodes: [{ id: "client-1", phone }] };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ errors: [{ message: "Field 'phones' doesn't exist on type 'Client'" }] }))
      .mockResolvedValueOnce(Response.json({ data: { clients: legacy } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchJobberClientPage("test-token")).resolves.toEqual({ ...legacy, additionalPhonesUnavailable: true });
    expect(query(fetchMock.mock.calls[1])).not.toContain("phones {");
    expect(query(fetchMock.mock.calls[1])).toContain("phone");
  });
});

describe("Jobber OAuth token errors", () => {
  it("surfaces only a safe provider error code", async () => {
    vi.stubEnv("JOBBER_CLIENT_ID", "client-id");
    vi.stubEnv("JOBBER_CLIENT_SECRET", "client-secret");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "invalid_client",
          error_description: "provider detail that must stay private",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      exchangeJobberAuthorizationCode(
        "authorization-code",
        "https://app.example.com/jobber/callback",
        "pkce-code-verifier",
      ),
    ).rejects.toThrow("Jobber token request failed (401: invalid_client)");

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect((request?.body as URLSearchParams).get("code_verifier")).toBe(
      "pkce-code-verifier",
    );
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
        "pkce-code-verifier",
      ),
    ).rejects.toThrow("Jobber token request failed (401)");
  });
});
