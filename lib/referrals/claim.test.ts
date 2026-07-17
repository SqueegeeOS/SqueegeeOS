import { describe, expect, it } from "vitest";
import { mapClaimRow } from "./claim";

describe("mapClaimRow", () => {
  it("maps a successful claim", () => {
    const result = mapClaimRow({
      outcome: "claimed",
      reward_id: "r1",
      status: "available",
      value_cents: 2500,
      claimed_at: "2026-07-17T00:00:00Z",
    });
    expect(result).toEqual({
      outcome: "claimed",
      rewardId: "r1",
      status: "available",
      valueCents: 2500,
      claimedAt: "2026-07-17T00:00:00Z",
    });
  });

  it("maps an idempotent retry to already_claimed", () => {
    expect(
      mapClaimRow({
        outcome: "already_claimed",
        reward_id: "r1",
        status: "available",
        value_cents: 2500,
        claimed_at: "2026-07-17T00:00:00Z",
      }).outcome,
    ).toBe("already_claimed");
  });

  it("treats unknown payloads as unavailable, never as claimed", () => {
    expect(mapClaimRow(null).outcome).toBe("unavailable");
    expect(mapClaimRow({}).outcome).toBe("unavailable");
    expect(mapClaimRow({ outcome: "surprise" }).outcome).toBe("unavailable");
  });

  it("defaults malformed fields safely", () => {
    const result = mapClaimRow({
      outcome: "unclaimable",
      reward_id: 42,
      status: "redeemed",
      value_cents: "2500",
      claimed_at: null,
    });
    expect(result.rewardId).toBeNull();
    expect(result.valueCents).toBe(0);
    expect(result.claimedAt).toBeNull();
    expect(result.status).toBe("redeemed");
  });
});
