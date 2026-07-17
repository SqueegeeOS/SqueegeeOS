import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolvePortalAccessByToken: vi.fn(),
  claimMemberReferralReward: vi.fn(),
  getAvailableCareCreditCents: vi.fn(),
}));

vi.mock("@/lib/persistence/queries/portal-access", () => ({
  resolvePortalAccessByToken: mocks.resolvePortalAccessByToken,
}));

vi.mock("@/lib/referrals/claim", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./claim")>()),
  claimMemberReferralReward: mocks.claimMemberReferralReward,
}));

vi.mock("@/lib/referrals/rewards", () => ({
  getAvailableCareCreditCents: mocks.getAvailableCareCreditCents,
}));

import { POST } from "@/app/api/referrals/portal/claim/route";

const REWARD_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function request(body: unknown): Request {
  return new Request("https://care.example.com/api/referrals/portal/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function authorize() {
  mocks.resolvePortalAccessByToken.mockResolvedValue({
    membershipId: "membership-1",
    memberName: "Juanita Example",
  });
}

describe("portal claim route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAvailableCareCreditCents.mockResolvedValue(2500);
  });

  it("requires portalToken, rewardId, and idempotencyKey", async () => {
    const response = await POST(request({ rewardId: REWARD_ID }));
    expect(response.status).toBe(400);
    expect(mocks.resolvePortalAccessByToken).not.toHaveBeenCalled();
    expect(mocks.claimMemberReferralReward).not.toHaveBeenCalled();
  });

  it("rejects oversized idempotency keys", async () => {
    const response = await POST(
      request({
        portalToken: "t",
        rewardId: REWARD_ID,
        idempotencyKey: "x".repeat(200),
      }),
    );
    expect(response.status).toBe(400);
  });

  it("returns 401 for an unknown token without claiming", async () => {
    mocks.resolvePortalAccessByToken.mockResolvedValue(null);

    const response = await POST(
      request({ portalToken: "bad", rewardId: REWARD_ID, idempotencyKey: "k1" }),
    );

    expect(response.status).toBe(401);
    expect(mocks.claimMemberReferralReward).not.toHaveBeenCalled();
  });

  it("resolves membership only from the token, ignoring body fields", async () => {
    authorize();
    mocks.claimMemberReferralReward.mockResolvedValue({
      outcome: "claimed",
      rewardId: REWARD_ID,
      label: "$25 HomeAtlas Care Credit",
      status: "available",
      valueCents: 2500,
      claimedAt: "2026-07-17T00:00:00Z",
    });

    const response = await POST(
      request({
        portalToken: "valid",
        rewardId: REWARD_ID,
        idempotencyKey: "k1",
        membershipId: "spoofed-membership",
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.claimMemberReferralReward).toHaveBeenCalledWith({
      membershipId: "membership-1",
      rewardId: REWARD_ID,
      idempotencyKey: "k1",
    });
  });

  it("returns the claim contract on success", async () => {
    authorize();
    mocks.claimMemberReferralReward.mockResolvedValue({
      outcome: "claimed",
      rewardId: REWARD_ID,
      label: "$25 HomeAtlas Care Credit",
      status: "available",
      valueCents: 2500,
      claimedAt: "2026-07-17T00:00:00Z",
    });

    const response = await POST(
      request({ portalToken: "valid", rewardId: REWARD_ID, idempotencyKey: "k1" }),
    );
    const payload = await response.json();

    expect(payload).toEqual({
      outcome: "claimed",
      reward: {
        id: REWARD_ID,
        label: "$25 HomeAtlas Care Credit",
        status: "available",
        valueCents: 2500,
      },
      availableCareCreditCents: 2500,
      creditApplicationReady: false,
    });
  });

  it("returns already_claimed idempotently", async () => {
    authorize();
    mocks.claimMemberReferralReward.mockResolvedValue({
      outcome: "already_claimed",
      rewardId: REWARD_ID,
      label: "$25 HomeAtlas Care Credit",
      status: "available",
      valueCents: 2500,
      claimedAt: "2026-07-17T00:00:00Z",
    });

    const response = await POST(
      request({ portalToken: "valid", rewardId: REWARD_ID, idempotencyKey: "k1" }),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).outcome).toBe("already_claimed");
  });

  it("maps not_found (including cross-membership rewards) to 404", async () => {
    authorize();
    mocks.claimMemberReferralReward.mockResolvedValue({ outcome: "not_found" });

    const response = await POST(
      request({ portalToken: "valid", rewardId: REWARD_ID, idempotencyKey: "k1" }),
    );
    expect(response.status).toBe(404);
  });

  it("rejects malformed reward ids as 404 without calling SQL", async () => {
    authorize();

    const response = await POST(
      request({
        portalToken: "valid",
        rewardId: "not-a-uuid",
        idempotencyKey: "k1",
      }),
    );

    expect(response.status).toBe(404);
    expect(mocks.claimMemberReferralReward).not.toHaveBeenCalled();
  });

  it("maps unclaimable to 409", async () => {
    authorize();
    mocks.claimMemberReferralReward.mockResolvedValue({ outcome: "unclaimable" });

    const response = await POST(
      request({ portalToken: "valid", rewardId: REWARD_ID, idempotencyKey: "k1" }),
    );
    expect(response.status).toBe(409);
  });

  it("returns a generic 500 without leaking claim errors or the token", async () => {
    authorize();
    mocks.claimMemberReferralReward.mockRejectedValue(
      new Error("db: secret detail"),
    );

    const response = await POST(
      request({
        portalToken: "super-secret-token",
        rewardId: REWARD_ID,
        idempotencyKey: "k1",
      }),
    );
    const text = JSON.stringify(await response.json());

    expect(response.status).toBe(500);
    expect(text).not.toContain("secret detail");
    expect(text).not.toContain("super-secret-token");
  });
});
