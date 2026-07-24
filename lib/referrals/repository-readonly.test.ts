import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const insert = vi.fn();
  const update = vi.fn();
  const upsert = vi.fn();
  const remove = vi.fn();
  const from = vi.fn();
  let hasCode = true;

  function query(result: { data: unknown; error: null; count?: number }) {
    const promise = Promise.resolve(result);
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "order", "limit"]) {
      builder[method] = vi.fn(() => builder);
    }
    builder.maybeSingle = vi.fn(() => promise);
    builder.insert = insert;
    builder.update = update;
    builder.upsert = upsert;
    builder.delete = remove;
    builder.then = (
      onfulfilled?: ((value: unknown) => unknown) | null,
      onrejected?: ((reason: unknown) => unknown) | null,
    ) => promise.then(onfulfilled, onrejected);
    return builder;
  }

  from.mockImplementation((table: string) => {
    if (table === "referral_codes") {
      return query({
        data: hasCode ? { id: "code-id", code: "SKREADONLY" } : null,
        error: null,
      });
    }
    if (table === "referral_visits") {
      return query({ data: null, error: null, count: 3 });
    }
    if (table === "referrals") {
      return query({
        data: [
          {
            id: "referral-1",
            lead_name: "Neighbor",
            lead_email: "neighbor@example.com",
            status: "converted",
            created_at: "2026-07-20T12:00:00.000Z",
            converted_at: "2026-07-24T12:00:00.000Z",
          },
        ],
        error: null,
      });
    }
    return query({ data: null, error: null });
  });

  return {
    client: { from },
    from,
    insert,
    update,
    upsert,
    remove,
    loadMemberReferralRewards: vi.fn(),
    setHasCode(value: boolean) {
      hasCode = value;
    },
  };
});

vi.mock("@/lib/persistence/config", () => ({
  isCloudPersistenceConnected: () => true,
}));

vi.mock("@/lib/persistence/supabase/client", () => ({
  createPrivilegedServerSupabaseClient: () => mocks.client,
}));

vi.mock("@/lib/referrals/rewards", () => ({
  loadMemberReferralRewards: mocks.loadMemberReferralRewards,
  syncReferralMilestoneRewards: vi.fn(),
}));

import { getMemberReferralSummary } from "./repository";

describe("getMemberReferralSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setHasCode(true);
    mocks.loadMemberReferralRewards.mockResolvedValue({
      convertedCount: 1,
      nextMilestone: null,
      rewards: [],
      availableCreditCents: 0,
      hasAvailablePercentReward: false,
    });
  });

  it("loads an existing referral summary without issuing or mutating rows", async () => {
    const summary = await getMemberReferralSummary(
      "membership-1",
      "Member Name",
      "https://care.example.com",
    );

    expect(summary?.code).toBe("SKREADONLY");
    expect(summary?.convertedCount).toBe(1);
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("returns no summary when activation has not issued a code", async () => {
    mocks.setHasCode(false);

    await expect(
      getMemberReferralSummary(
        "membership-1",
        "Member Name",
        "https://care.example.com",
      ),
    ).resolves.toBeNull();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
