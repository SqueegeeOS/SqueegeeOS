import { beforeEach, describe, expect, it, vi } from "vitest";

const ACTOR_ID = "2d9bfd32-1262-40af-9ce2-33f5710ed85b";
const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  consume: vi.fn(),
  exchange: vi.fn(),
  fetchAccount: vi.fn(),
  saveConnection: vi.fn(),
  resolveRedirect: vi.fn(),
  getExpectedAccountId: vi.fn(),
}));

vi.mock("@/lib/auth/hq-route-authorization", () => ({
  authorizeHqApiRequest: mocks.authorize,
}));
vi.mock("@/lib/care-operations/jobber-oauth-state", () => ({
  consumeJobberOAuthState: mocks.consume,
}));
vi.mock("@/lib/care-operations/jobber-api", () => ({
  exchangeJobberAuthorizationCode: mocks.exchange,
  fetchJobberAccountIdentity: mocks.fetchAccount,
}));
vi.mock("@/lib/care-operations/jobber-connection-store", () => ({
  saveJobberConnection: mocks.saveConnection,
}));
vi.mock("@/lib/care-operations/jobber-oauth-config", () => ({
  getExpectedJobberAccountId: mocks.getExpectedAccountId,
  resolveJobberOAuthRedirectUri: mocks.resolveRedirect,
}));

import { GET } from "../../app/api/admin/care-operations/jobber/oauth/callback/route";

function callback(query: string) {
  return GET(
    new Request(
      `https://homeatlas.example/api/admin/care-operations/jobber/oauth/callback?${query}`,
    ),
  );
}

function redirectReason(response: Response): string | null {
  const location = response.headers.get("location");
  return location ? new URL(location).searchParams.get("reason") : null;
}

describe("Jobber OAuth callback state consumption", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue({
      actor: { id: ACTOR_ID, email: "operator@example.com", role: "operator" },
    });
    mocks.getExpectedAccountId.mockReturnValue("jobber-account");
  });

  it("validates and consumes state before interpreting provider denial", async () => {
    mocks.consume.mockResolvedValue(true);
    const response = await callback("error=access_denied&state=valid-state");
    expect(mocks.consume).toHaveBeenCalledOnce();
    expect(mocks.consume).toHaveBeenCalledWith("valid-state", ACTOR_ID);
    expect(redirectReason(response)).toBe("authorization_denied");
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it.each([
    ["state=valid-state", "missing code"],
    ["state=valid-state&code=bad%0Acode", "malformed code"],
  ])("consumes state once before rejecting %s", async (query) => {
    mocks.consume.mockResolvedValue(true);
    const response = await callback(query);
    expect(mocks.consume).toHaveBeenCalledOnce();
    expect(redirectReason(response)).toBe("missing_code");
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it("treats denial with missing or invalid state as invalid state", async () => {
    mocks.consume.mockResolvedValue(false);
    const response = await callback("error=access_denied");
    expect(mocks.consume).toHaveBeenCalledOnce();
    expect(mocks.consume).toHaveBeenCalledWith("", ACTOR_ID);
    expect(redirectReason(response)).toBe("invalid_state");
  });

  it("rejects replay after the first callback consumed state", async () => {
    mocks.consume.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const first = await callback("error=access_denied&state=one-time-state");
    const replay = await callback("error=access_denied&state=one-time-state");
    expect(redirectReason(first)).toBe("authorization_denied");
    expect(redirectReason(replay)).toBe("invalid_state");
    expect(mocks.consume).toHaveBeenCalledTimes(2);
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it("consumes state before a successful exchange and persists the actor", async () => {
    const tokens = {
      accessToken: "access-token",
      refreshToken: "refresh-token",
      accessTokenExpiresAt: "2026-07-15T00:00:00.000Z",
    };
    const account = { id: "jobber-account", name: "SqueegeeKing" };
    mocks.consume.mockResolvedValue(true);
    mocks.resolveRedirect.mockReturnValue(
      "https://homeatlas.example/api/admin/care-operations/jobber/oauth/callback",
    );
    mocks.exchange.mockResolvedValue(tokens);
    mocks.fetchAccount.mockResolvedValue(account);
    mocks.saveConnection.mockResolvedValue(undefined);

    const response = await callback("code=valid-code&state=valid-state");
    expect(mocks.consume).toHaveBeenCalledOnce();
    expect(mocks.consume.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.exchange.mock.invocationCallOrder[0],
    );
    expect(mocks.saveConnection).toHaveBeenCalledWith({
      account,
      tokens,
      actorId: ACTOR_ID,
    });
    expect(new URL(response.headers.get("location")!).searchParams.get("jobber"))
      .toBe("connected");
  });

  it("fails closed before provider calls when expected account authority is absent", async () => {
    mocks.consume.mockResolvedValue(true);
    mocks.getExpectedAccountId.mockImplementation(() => {
      throw new Error("JOBBER_EXPECTED_ACCOUNT_ID is not configured");
    });

    const response = await callback("code=valid-code&state=valid-state");

    expect(redirectReason(response)).toBe("connection_failed");
    expect(mocks.exchange).not.toHaveBeenCalled();
    expect(mocks.fetchAccount).not.toHaveBeenCalled();
    expect(mocks.saveConnection).not.toHaveBeenCalled();
  });

  it("rejects the wrong returned account before persistence", async () => {
    mocks.consume.mockResolvedValue(true);
    mocks.resolveRedirect.mockReturnValue(
      "https://homeatlas.example/api/admin/care-operations/jobber/oauth/callback",
    );
    mocks.exchange.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      accessTokenExpiresAt: "2026-07-15T00:00:00.000Z",
    });
    mocks.fetchAccount.mockResolvedValue({
      id: "different-jobber-account",
      name: "Different company",
    });

    const response = await callback("code=valid-code&state=valid-state");

    expect(redirectReason(response)).toBe("connection_failed");
    expect(mocks.saveConnection).not.toHaveBeenCalled();
  });
});
