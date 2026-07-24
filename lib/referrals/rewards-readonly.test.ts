import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const insert = vi.fn();
  const update = vi.fn();
  const upsert = vi.fn();
  const remove = vi.fn();
  const from = vi.fn();

  function query() {
    const result = Promise.resolve({
      data: [
        {
          id: "reward-1",
          membership_id: "membership-1",
          milestone_converted_count: 1,
          reward_type: "care_credit",
          reward_label: "$25 HomeAtlas Care Credit",
          value_cents: 2500,
          value_percent: null,
          status: "available",
          earned_at: "2026-07-24T12:00:00.000Z",
          redeemed_at: null,
        },
      ],
      error: null,
    });
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "order"]) {
      builder[method] = vi.fn(() => builder);
    }
    builder.insert = insert;
    builder.update = update;
    builder.upsert = upsert;
    builder.delete = remove;
    builder.then = (
      onfulfilled?: ((value: unknown) => unknown) | null,
      onrejected?: ((reason: unknown) => unknown) | null,
    ) => result.then(onfulfilled, onrejected);
    return builder;
  }

  from.mockImplementation(() => query());
  return {
    client: { from },
    from,
    insert,
    update,
    upsert,
    remove,
  };
});

vi.mock("@/lib/persistence/config", () => ({
  isCloudPersistenceConnected: () => true,
}));

vi.mock("@/lib/persistence/supabase/client", () => ({
  createServerSupabaseClient: () => mocks.client,
}));

import { loadMemberReferralRewards } from "./rewards";

describe("loadMemberReferralRewards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads earned rewards without issuing milestone rows during portal load", async () => {
    const view = await loadMemberReferralRewards("membership-1", 1);

    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledWith("member_referral_rewards");
    expect(view.availableCreditCents).toBe(2500);
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
