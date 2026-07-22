import { describe, expect, it, vi } from "vitest";
import {
  acquireJobberRefreshLease,
  persistJobberRefreshFailure,
  persistJobberRefreshSuccess,
  refreshLeasedJobberConnection,
  saveJobberConnection,
} from "./jobber-connection-store";
import { JobberApiError } from "./jobber-api";

const INPUT = {
  account: { id: "jobber-account-1", name: "SqueegeeKing" },
  tokens: {
    accessToken: "plain-access-token",
    refreshToken: "plain-refresh-token",
    accessTokenExpiresAt: "2026-07-15T00:00:00.000Z",
  },
  actorId: "2d9bfd32-1262-40af-9ce2-33f5710ed85b",
};

describe("atomic Jobber connection persistence", () => {
  it("uses one database operation containing encrypted state and actor identity", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    await expect(
      saveJobberConnection(INPUT, {
        client: { rpc } as never,
        encryptToken: (value) => `encrypted:${value.length}`,
      }),
    ).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("save_jobber_connection_with_event", {
      requested_account_id: "jobber-account-1",
      requested_account_name: "SqueegeeKing",
      requested_access_token_ciphertext: "encrypted:18",
      requested_refresh_token_ciphertext: "encrypted:19",
      requested_access_token_expires_at: "2026-07-15T00:00:00.000Z",
      requested_graphql_version: expect.any(String),
      requested_actor_id: "2d9bfd32-1262-40af-9ce2-33f5710ed85b",
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("plain-access-token");
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("plain-refresh-token");
  });

  it("fails the callback persistence when the atomic RPC injects an event failure", async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: { message: "injected jobber_connection_events failure" },
    });

    await expect(
      saveJobberConnection(INPUT, {
        client: { rpc } as never,
        encryptToken: () => "encrypted-token",
      }),
    ).rejects.toThrow("injected jobber_connection_events failure");
    expect(rpc).toHaveBeenCalledOnce();
  });
});

describe("atomic Jobber refresh persistence", () => {
  it("acquires a lease only for the token generation that was read", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    await expect(
      acquireJobberRefreshLease({ rpc } as never, {
        leaseId: "00000000-0000-0000-0000-000000000011",
        tokenGeneration: 7,
      }),
    ).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith(
      "acquire_jobber_refresh_lease_for_generation",
      {
        requested_lease_id: "00000000-0000-0000-0000-000000000011",
        requested_token_generation: 7,
        lease_seconds: 30,
      },
    );
  });

  it("persists rotated tokens and the refreshed event in one RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    await expect(
      persistJobberRefreshSuccess({ rpc } as never, {
        leaseId: "00000000-0000-0000-0000-000000000011",
        tokenGeneration: 7,
        accessTokenCiphertext: "new-access-ciphertext",
        refreshTokenCiphertext: "new-refresh-ciphertext",
        accessTokenExpiresAt: "2026-07-15T00:00:00.000Z",
      }),
    ).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith("complete_jobber_refresh_with_event", {
      requested_lease_id: "00000000-0000-0000-0000-000000000011",
      requested_token_generation: 7,
      requested_access_token_ciphertext: "new-access-ciphertext",
      requested_refresh_token_ciphertext: "new-refresh-ciphertext",
      requested_access_token_expires_at: "2026-07-15T00:00:00.000Z",
    });
  });

  it("persists refresh failure state and its event in one RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    await expect(
      persistJobberRefreshFailure({ rpc } as never, {
        leaseId: "00000000-0000-0000-0000-000000000012",
        tokenGeneration: 8,
        reauthorizationRequired: true,
      }),
    ).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith("fail_jobber_refresh_with_event", {
      requested_lease_id: "00000000-0000-0000-0000-000000000012",
      requested_token_generation: 8,
      requested_reauthorization_required: true,
    });
  });

  it.each([
    [persistJobberRefreshSuccess, "refreshed event write failed"],
    [persistJobberRefreshFailure, "refresh_failed event write failed"],
  ])("fails closed when an atomic event insert rolls back", async (persist, message) => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message },
    });
    const common = {
      leaseId: "00000000-0000-0000-0000-000000000012",
      tokenGeneration: 8,
      reauthorizationRequired: true,
      accessTokenCiphertext: "new-access-ciphertext",
      refreshTokenCiphertext: "new-refresh-ciphertext",
      accessTokenExpiresAt: "2026-07-15T00:00:00.000Z",
    };
    await expect(persist({ rpc } as never, common)).rejects.toThrow(message);
  });

  it.each([persistJobberRefreshSuccess, persistJobberRefreshFailure])(
    "returns false without claiming a transition when the lease or generation is stale",
    async (persist) => {
      const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
      const common = {
        leaseId: "00000000-0000-0000-0000-000000000099",
        tokenGeneration: 2,
        reauthorizationRequired: false,
        accessTokenCiphertext: "stale-access-ciphertext",
        refreshTokenCiphertext: "stale-refresh-ciphertext",
        accessTokenExpiresAt: "2026-07-15T00:00:00.000Z",
      };
      await expect(persist({ rpc } as never, common)).resolves.toBe(false);
    },
  );

  it("does not record a failure after successful provider rotation loses its lease", async () => {
    const persistFailure = vi.fn();
    await expect(
      refreshLeasedJobberConnection(
        {
          client: {} as never,
          leaseId: "00000000-0000-0000-0000-000000000011",
          tokenGeneration: 7,
          refreshTokenCiphertext: "old-refresh-ciphertext",
        },
        {
          decryptToken: () => "old-refresh-token",
          encryptToken: (value) => `encrypted:${value}`,
          refreshTokens: vi.fn().mockResolvedValue({
            accessToken: "new-access-token",
            refreshToken: "new-refresh-token",
            accessTokenExpiresAt: "2026-07-15T00:00:00.000Z",
          }),
          persistSuccess: vi.fn().mockResolvedValue(false),
          persistFailure,
        },
      ),
    ).rejects.toThrow("lost its lease to newer connection state");
    expect(persistFailure).not.toHaveBeenCalled();
  });

  it("does not call the token provider when the owning sync fence is lost", async () => {
    const refreshTokens = vi.fn();
    const persistFailure = vi.fn();
    await expect(
      refreshLeasedJobberConnection(
        {
          client: {} as never,
          leaseId: "00000000-0000-0000-0000-000000000013",
          tokenGeneration: 9,
          refreshTokenCiphertext: "old-refresh-ciphertext",
        },
        {
          beforeProviderRequest: vi.fn().mockRejectedValue(
            new Error("coverage lease lost"),
          ),
          decryptToken: () => "old-refresh-token",
          refreshTokens,
          persistFailure,
        },
      ),
    ).rejects.toThrow("coverage lease lost");
    expect(refreshTokens).not.toHaveBeenCalled();
    expect(persistFailure).not.toHaveBeenCalled();
  });

  it("does not overwrite concurrent reauthorization after provider refresh failure", async () => {
    const persistFailure = vi.fn().mockResolvedValue(false);
    await expect(
      refreshLeasedJobberConnection(
        {
          client: {} as never,
          leaseId: "00000000-0000-0000-0000-000000000012",
          tokenGeneration: 8,
          refreshTokenCiphertext: "old-refresh-ciphertext",
        },
        {
          decryptToken: () => "old-refresh-token",
          refreshTokens: vi
            .fn()
            .mockRejectedValue(new JobberApiError("invalid grant", 401)),
          persistFailure,
        },
      ),
    ).rejects.toThrow("lost its lease to newer connection state");
    expect(persistFailure).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ reauthorizationRequired: true }),
    );
  });
});
