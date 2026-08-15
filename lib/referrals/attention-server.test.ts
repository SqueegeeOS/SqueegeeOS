import { afterEach, describe, expect, it, vi } from "vitest";

let codeResult: { data: unknown; error: { message: string } | null } = {
  data: [],
  error: null,
};
let referralResult: { data: unknown; error: { message: string } | null } = {
  data: [],
  error: null,
};
let rewardResult: { data: unknown; error: { message: string } | null } = {
  data: [],
  error: null,
};

function chain(result: () => { data: unknown; error: { message: string } | null }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "order", "limit", "in"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (
    onfulfilled?: ((value: unknown) => unknown) | null,
    onrejected?: ((reason: unknown) => unknown) | null,
  ) => Promise.resolve(result()).then(onfulfilled, onrejected);
  return builder;
}

const fromSpy = vi.fn((table: string) => {
  if (table === "referral_codes") return chain(() => codeResult);
  if (table === "referrals") return chain(() => referralResult);
  if (table === "member_referral_rewards") return chain(() => rewardResult);
  throw new Error(`Unexpected table ${table}`);
});

vi.mock("@/lib/persistence/config", () => ({
  isCloudPersistenceConnected: vi.fn(() => true),
}));
vi.mock("@/lib/persistence/supabase/client", () => ({
  createPrivilegedServerSupabaseClient: vi.fn(() => ({ from: fromSpy })),
}));

describe("referral attention server", () => {
  afterEach(() => {
    codeResult = { data: [], error: null };
    referralResult = { data: [], error: null };
    rewardResult = { data: [], error: null };
    vi.clearAllMocks();
  });

  it("maps pending, converted, and available reward evidence without writes", async () => {
    codeResult = {
      data: [
        {
          id: "code-1",
          code: "SKMINTY",
          member_name: "Mandi Rivera",
          membership_id: "membership-1",
        },
      ],
      error: null,
    };
    referralResult = {
      data: [
        {
          referral_code_id: "code-1",
          status: "pending",
          created_at: "2026-08-01T18:00:00.000Z",
          converted_at: null,
        },
        {
          referral_code_id: "code-1",
          status: "converted",
          created_at: "2026-08-02T18:00:00.000Z",
          converted_at: "2026-08-10T18:00:00.000Z",
        },
      ],
      error: null,
    };
    rewardResult = {
      data: [
        {
          membership_id: "membership-1",
          reward_type: "care_credit",
          value_cents: 2_500,
          status: "available",
        },
      ],
      error: null,
    };

    const { loadReferralAttentionSnapshot } = await import(
      "./attention-server"
    );
    await expect(
      loadReferralAttentionSnapshot(new Date("2026-08-14T18:00:00.000Z")),
    ).resolves.toEqual({
      generatedAt: "2026-08-14T18:00:00.000Z",
      truncated: false,
      members: [
        {
          membershipId: "membership-1",
          memberName: "Mandi Rivera",
          code: "SKMINTY",
          pendingReferralCount: 1,
          oldestPendingAt: "2026-08-01T18:00:00.000Z",
          convertedUnrewardedCount: 1,
          oldestConvertedAt: "2026-08-10T18:00:00.000Z",
          availableRewardCount: 1,
          availableCareCreditCents: 2_500,
        },
      ],
    });
    expect(fromSpy.mock.calls.map(([table]) => table)).toEqual([
      "referral_codes",
      "referrals",
      "member_referral_rewards",
    ]);
  });

  it("fails closed when reward evidence cannot be read", async () => {
    codeResult = {
      data: [
        {
          id: "code-1",
          code: "SKMINTY",
          member_name: "Mandi Rivera",
          membership_id: "membership-1",
        },
      ],
      error: null,
    };
    rewardResult = { data: null, error: { message: "reward read failed" } };
    const { loadReferralAttentionSnapshot } = await import(
      "./attention-server"
    );

    await expect(loadReferralAttentionSnapshot()).rejects.toThrow(
      "reward read failed",
    );
  });
});
