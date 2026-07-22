import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  runSync: vi.fn(),
  readStatus: vi.fn(),
}));

vi.mock("@/lib/auth/hq-route-authorization", () => ({
  authorizeHqApiRequest: mocks.authorize,
}));
vi.mock("@/lib/care-operations/jobber-coverage-sync", () => ({
  runJobberCoverageSync: mocks.runSync,
}));
vi.mock("@/lib/care-operations/jobber-coverage-store", () => ({
  jobberCoveragePersistence: { kind: "test-store" },
  readJobberCoverageSyncStatus: mocks.readStatus,
}));

import {
  maxDuration,
  POST,
} from "../../app/api/admin/care-operations/jobber/sync/route";
import { GET } from "../../app/api/admin/care-operations/jobber/sync/status/route";
import { POST as POST_SAMPLE } from "../../app/api/admin/care-operations/jobber/visits/sample/route";

const actor = {
  id: "2d9bfd32-1262-40af-9ce2-33f5710ed85b",
  email: "operator@example.invalid",
  role: "operator" as const,
};

describe("Jobber coverage routes", () => {
  beforeEach(() => {
    mocks.authorize.mockReset();
    mocks.runSync.mockReset();
    mocks.readStatus.mockReset();
  });

  it("declares the bounded five-minute deployment envelope", () => {
    expect(maxDuration).toBe(300);
  });

  it.each([401, 403])(
    "returns authorization %i before POST provider or storage work",
    async (status) => {
      mocks.authorize.mockResolvedValue({
        response: NextResponse.json({ error: "boundary" }, { status }),
      });
      const response = await POST();
      expect(response.status).toBe(status);
      expect(mocks.runSync).not.toHaveBeenCalled();
    },
  );

  it.each([401, 403])(
    "returns authorization %i before GET storage work",
    async (status) => {
      mocks.authorize.mockResolvedValue({
        response: NextResponse.json({ error: "boundary" }, { status }),
      });
      const response = await GET();
      expect(response.status).toBe(status);
      expect(mocks.readStatus).not.toHaveBeenCalled();
    },
  );

  it("passes the authenticated actor into the manual sync", async () => {
    mocks.authorize.mockResolvedValue({ actor });
    mocks.runSync.mockResolvedValue({
      outcome: "complete",
      runId: "00000000-0000-0000-0000-000000000038",
      failureCode: null,
      requestCount: 2,
      leafCount: 2,
      visitCount: 1,
      window: {
        startAt: "2026-04-17T07:00:00.000Z",
        endAt: "2027-07-17T07:00:00.000Z",
      },
    });
    const response = await POST();
    expect(response.status).toBe(200);
    expect(mocks.runSync).toHaveBeenCalledWith(
      actor,
      { kind: "test-store" },
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("returns accepted indeterminate without claiming the prior schedule is unchanged", async () => {
    mocks.authorize.mockResolvedValue({ actor });
    mocks.runSync.mockResolvedValue({
      outcome: "indeterminate",
      runId: "00000000-0000-0000-0000-000000000938",
      failureCode: "finalization_indeterminate",
      requestCount: 2,
      leafCount: 2,
      visitCount: 1,
      window: {
        startAt: "2026-04-17T07:00:00.000Z",
        endAt: "2027-07-17T07:00:00.000Z",
      },
    });
    const response = await POST();
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({
      outcome: "indeterminate",
      failureCode: "finalization_indeterminate",
    });
  });

  it("returns an explicitly uncached truthful status", async () => {
    mocks.authorize.mockResolvedValue({ actor });
    mocks.readStatus.mockResolvedValue({
      coverageState: "partial",
      freshnessThresholdMinutes: 30,
      fresh: false,
      syncInProgress: false,
      latestRun: null,
      watermark: null,
    });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ coverageState: "partial" });
    expect(response.headers.get("cache-control")).toBe(
      "private, no-cache, no-store, must-revalidate, max-age=0",
    );
  });

  it("retires the legacy sample projection writer", async () => {
    mocks.authorize.mockResolvedValue({ actor });
    const response = await POST_SAMPLE();
    expect(response.status).toBe(410);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("coverage-proven"),
    });
    expect(mocks.runSync).not.toHaveBeenCalled();
  });
});
