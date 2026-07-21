import { describe, expect, it } from "vitest";
import {
  HqAccessError,
  requireHqActorWithClients,
  type HqAdminLookupClient,
  type HqAuthClient,
} from "./hq-access";
import { authorizeHqApiRequest } from "./hq-route-authorization";

const USER_ID = "2d9bfd32-1262-40af-9ce2-33f5710ed85b";

function authClient(
  user: { id: string; email?: string } | null,
  error: {
    status?: number;
    name?: string;
    code?: string;
    message?: string;
  } | null = null,
): HqAuthClient {
  return { auth: { getUser: async () => ({ data: { user }, error }) } };
}

function adminClient(
  data: {
    user_id: string;
    email: string;
    role: "owner" | "operator";
    active: boolean;
  } | null,
  error: { message: string } | null = null,
): HqAdminLookupClient {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data, error }),
        }),
      }),
    }),
  };
}

describe("requireHqActor", () => {
  it("returns 401 when Supabase Auth has no verified user", async () => {
    await expect(
      requireHqActorWithClients(authClient(null), adminClient(null)),
    ).rejects.toMatchObject({ status: 401 });
  });

  it.each([
    [{ name: "AuthSessionMissingError", status: 400 }, "missing session"],
    [{ name: "AuthApiError", status: 401, code: "bad_jwt" }, "invalid token"],
    [
      { name: "AuthInvalidJwtError", status: 400, code: "invalid_jwt" },
      "locally invalid JWT",
    ],
    [
      { name: "AuthApiError", status: 400, code: "session_expired" },
      "expired session",
    ],
  ])("returns 401 for a truly %s", async (error, description) => {
    void description;
    await expect(
      requireHqActorWithClients(
        authClient(null, error),
        adminClient(null),
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it.each([
    [
      {
        name: "AuthRetryableFetchError",
        status: 503,
        message: "upstream unavailable",
      },
      "retryable transport error",
    ],
    [
      { name: "AuthApiError", status: 500, code: "unexpected_failure" },
      "provider 5xx",
    ],
    [
      { name: "AuthUnknownError", message: "connection reset" },
      "provider error without status",
    ],
    [{ name: "AuthApiError", status: 429 }, "provider rate limit"],
    [
      { name: "AuthApiError", status: 401, code: "invalid_api_key" },
      "provider configuration 401",
    ],
    [{ name: "AuthApiError", status: 401 }, "ambiguous provider 401"],
  ])("returns 503 for a returned %s", async (error, description) => {
    void description;
    await expect(
      requireHqActorWithClients(
        authClient(null, error),
        adminClient(null),
      ),
    ).rejects.toMatchObject({ status: 503 });
  });

  it("returns 403 for an authenticated but inactive or unapproved user", async () => {
    await expect(
      requireHqActorWithClients(
        authClient({ id: USER_ID, email: "operator@example.com" }),
        adminClient({
          user_id: USER_ID,
          email: "operator@example.com",
          role: "operator",
          active: false,
        }),
      ),
    ).rejects.toMatchObject({ status: 403 });

    await expect(
      requireHqActorWithClients(
        authClient({ id: USER_ID, email: "operator@example.com" }),
        adminClient(null),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("returns the active allowlisted actor UUID for audit propagation", async () => {
    await expect(
      requireHqActorWithClients(
        authClient({ id: USER_ID, email: "OWNER@EXAMPLE.COM" }),
        adminClient({
          user_id: USER_ID,
          email: "owner@example.com",
          role: "owner",
          active: true,
        }),
      ),
    ).resolves.toEqual({
      id: USER_ID,
      email: "owner@example.com",
      role: "owner",
    });
  });

  it("rejects an allowlist row that does not match the verified Auth email", async () => {
    await expect(
      requireHqActorWithClients(
        authClient({ id: USER_ID, email: "other@example.com" }),
        adminClient({
          user_id: USER_ID,
          email: "owner@example.com",
          role: "owner",
          active: true,
        }),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("fails closed on Auth and allowlist lookup failures", async () => {
    const throwingAuth: HqAuthClient = {
      auth: {
        getUser: async () => {
          throw new Error("network failure");
        },
      },
    };
    await expect(
      requireHqActorWithClients(throwingAuth, adminClient(null)),
    ).rejects.toMatchObject({ status: 503 });
    await expect(
      requireHqActorWithClients(
        authClient({ id: USER_ID, email: "owner@example.com" }),
        adminClient(null, { message: "table unavailable" }),
      ),
    ).rejects.toMatchObject({ status: 503 });
  });
});

describe("HQ API authorization responses", () => {
  it.each([
    [401, "Authentication required"],
    [403, "Forbidden"],
    [503, "Headquarters access is unavailable"],
  ] as const)("returns %i without leaking internal errors", async (status, message) => {
    const result = await authorizeHqApiRequest(async () => {
      throw new HqAccessError(status, "sensitive provider detail");
    });
    expect(result.response?.status).toBe(status);
    await expect(result.response?.json()).resolves.toEqual({ error: message });
    expect(result.response?.headers.get("Cache-Control")).toBe(
      "private, no-cache, no-store, must-revalidate, max-age=0",
    );
    expect(result.response?.headers.get("Expires")).toBe("0");
    expect(result.response?.headers.get("Pragma")).toBe("no-cache");
  });
});
