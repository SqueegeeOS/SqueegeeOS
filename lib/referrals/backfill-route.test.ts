import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { partitionMissingCodes } from "./backfill";

const mocks = vi.hoisted(() => ({
  authorizeHqApiRequest: vi.fn(),
  backfillReferralCodes: vi.fn(),
}));

vi.mock("@/lib/auth/hq-route-authorization", () => ({
  authorizeHqApiRequest: mocks.authorizeHqApiRequest,
}));

vi.mock("@/lib/referrals/backfill", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./backfill")>()),
  backfillReferralCodes: mocks.backfillReferralCodes,
}));

import { POST } from "@/app/api/admin/referrals/backfill-codes/route";

function request(body?: unknown): Request {
  return new Request("https://care.example.com/api/admin/referrals/backfill-codes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? "" : JSON.stringify(body),
  });
}

describe("referral code backfill route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated requests without running the backfill", async () => {
    mocks.authorizeHqApiRequest.mockResolvedValue({
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    });

    const response = await POST(request({ dryRun: false }));

    expect(response.status).toBe(401);
    expect(mocks.backfillReferralCodes).not.toHaveBeenCalled();
  });

  it("defaults to dry-run when no body is sent", async () => {
    mocks.authorizeHqApiRequest.mockResolvedValue({ actor: { email: "hq@x" } });
    mocks.backfillReferralCodes.mockResolvedValue({ dryRun: true, missing: [] });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.backfillReferralCodes).toHaveBeenCalledWith({ dryRun: true });
  });

  it("defaults to dry-run unless dryRun is explicitly false", async () => {
    mocks.authorizeHqApiRequest.mockResolvedValue({ actor: { email: "hq@x" } });
    mocks.backfillReferralCodes.mockResolvedValue({ dryRun: true, missing: [] });

    await POST(request({ dryRun: "yes-ish" }));
    expect(mocks.backfillReferralCodes).toHaveBeenLastCalledWith({ dryRun: true });

    await POST(request({ dryRun: false }));
    expect(mocks.backfillReferralCodes).toHaveBeenLastCalledWith({ dryRun: false });
  });
});

describe("partitionMissingCodes", () => {
  const members = [
    { membershipId: "m1", memberName: "One" },
    { membershipId: "m2", memberName: "Two" },
  ];

  it("returns only memberships without codes", () => {
    expect(partitionMissingCodes(members, new Set(["m1"]))).toEqual([
      { membershipId: "m2", memberName: "Two" },
    ]);
  });

  it("returns nothing when everyone has a code", () => {
    expect(partitionMissingCodes(members, new Set(["m1", "m2"]))).toEqual([]);
  });
});
