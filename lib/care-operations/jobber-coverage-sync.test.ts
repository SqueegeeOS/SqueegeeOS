import { describe, expect, it, vi } from "vitest";
import type { HqActor } from "@/lib/auth/hq-access";
import type { JobberVisitSampleNode } from "./jobber-api";
import type { JobberCoveragePage } from "./jobber-coverage-provider";
import {
  buildJobberCoveragePassManifest,
  crawlJobberCoveragePass,
  fixedPacificCoverageWindow,
  JOBBER_COVERAGE_MAX_REQUESTS,
  runJobberCoverageSync,
  splitCoverageWindow,
  type JobberCoverageLeaf,
  type JobberCoverageObservation,
  type JobberCoveragePassManifest,
  type JobberCoveragePersistence,
  type JobberCoverageReservedWork,
} from "./jobber-coverage-sync";

const actor: HqActor = {
  id: "2d9bfd32-1262-40af-9ce2-33f5710ed85b",
  email: "operator@example.invalid",
  role: "operator",
};

function visit(id: string, startAt: string): JobberVisitSampleNode {
  return {
    id,
    title: null,
    visitStatus: "OPAQUE",
    isComplete: false,
    startAt,
    endAt: null,
    completedAt: null,
    client: { id: `client-${id}`, name: "Sanitized" },
    property: {
      id: `property-${id}`,
      jobberWebUri: `https://secure.getjobber.com/properties/${id}`,
    },
    job: {
      id: `job-${id}`,
      jobNumber: 1,
      title: null,
      jobStatus: "OPAQUE",
    },
  };
}

function persistence(
  overrides: Partial<JobberCoveragePersistence> = {},
): JobberCoveragePersistence & {
  startOrResumeRun: ReturnType<typeof vi.fn>;
  reserveNextWork: ReturnType<typeof vi.fn>;
  recordOverflow: ReturnType<typeof vi.fn>;
  recordLeaf: ReturnType<typeof vi.fn>;
  loadPass: ReturnType<typeof vi.fn>;
  completePass: ReturnType<typeof vi.fn>;
  pauseRun: ReturnType<typeof vi.fn>;
  renewLease: ReturnType<typeof vi.fn>;
  finalizeRun: ReturnType<typeof vi.fn>;
  reconcileFinalization: ReturnType<typeof vi.fn>;
  markPartial: ReturnType<typeof vi.fn>;
} {
  let started = false;
  let paused = false;
  let durableRunId = "";
  let durableWindow = {
    startAt: "2026-04-17T07:00:00.000Z",
    endAt: "2027-07-17T07:00:00.000Z",
  };
  let currentPass: 1 | 2 = 1;
  let requestCount = 0;
  let acquisitionGeneration = 0;
  const pending: Record<1 | 2, Array<{
    partitionPath: string;
    window: typeof durableWindow;
  }>> = { 1: [], 2: [] };
  const leaves: Record<1 | 2, JobberCoverageLeaf[]> = { 1: [], 2: [] };

  const store = {
    startOrResumeRun: vi.fn(async (input) => {
      acquisitionGeneration += 1;
      if (!started) {
        started = true;
        durableRunId = input.proposedRunId;
        durableWindow = input.proposedWindow;
        pending[1] = [{ partitionPath: "r", window: durableWindow }];
      }
      const leafCount = leaves[1].length + leaves[2].length;
      return {
        outcome: paused ? "resumed" as const : "started" as const,
        runId: durableRunId,
        acquisitionGeneration,
        ownerToken: `00000000-0000-4000-8000-${String(acquisitionGeneration).padStart(12, "0")}`,
        watermarkGeneration: 4,
        window: durableWindow,
        currentPass,
        passReadyToComplete:
          pending[currentPass].length === 0 && leaves[currentPass].length > 0,
        requestCount,
        leafCount,
        visitCount: leaves[2].reduce(
          (count, leaf) => count + leaf.observations.length,
          0,
        ),
      };
    }),
    reserveNextWork: vi.fn(async ({ attemptId }) => {
      const next = pending[currentPass].shift();
      if (!next) throw new Error("frontier was empty");
      requestCount += 1;
      return {
        outcome: "reserved" as const,
        attemptId,
        pass: currentPass,
        partitionPath: next.partitionPath,
        window: next.window,
      };
    }),
    recordOverflow: vi.fn(async ({ work, children }: {
      work: JobberCoverageReservedWork;
      children: [typeof durableWindow, typeof durableWindow];
    }) => {
      pending[work.pass].unshift(
        { partitionPath: `${work.partitionPath}0`, window: children[0] },
        { partitionPath: `${work.partitionPath}1`, window: children[1] },
      );
    }),
    recordLeaf: vi.fn(async ({ work, observations, manifestSha256 }: {
      work: JobberCoverageReservedWork;
      observations: JobberCoverageObservation[];
      manifestSha256: string;
    }) => {
      leaves[work.pass].push({
        pass: work.pass,
        leafIndex: leaves[work.pass].length,
        window: work.window,
        observations,
        manifestSha256,
      });
      return { passReadyToComplete: pending[work.pass].length === 0 };
    }),
    loadPass: vi.fn(async ({ pass }: { pass: 1 | 2 }) =>
      buildJobberCoveragePassManifest(pass, leaves[pass], requestCount)),
    completePass: vi.fn(async ({ manifest }: {
      manifest: JobberCoveragePassManifest;
    }) => {
      if (manifest.pass === 1) {
        currentPass = 2;
        pending[2] = [{ partitionPath: "r", window: durableWindow }];
        return "pass_two_ready" as const;
      }
      return "ready_to_finalize" as const;
    }),
    pauseRun: vi.fn(async () => {
      paused = true;
    }),
    renewLease: vi.fn().mockResolvedValue(undefined),
    finalizeRun: vi.fn().mockResolvedValue("completed"),
    reconcileFinalization: vi.fn().mockResolvedValue("not_completed"),
    markPartial: vi.fn().mockResolvedValue(undefined),
  };
  return Object.assign(store, overrides) as never;
}

describe("fixed Pacific coverage bounds", () => {
  it("keeps the GraphQL request budget inside the documented route envelope", () => {
    expect(JOBBER_COVERAGE_MAX_REQUESTS).toBe(14);
  });

  it("covers 90 Pacific calendar days back through the full 365th forward day", () => {
    expect(
      fixedPacificCoverageWindow(new Date("2026-07-16T18:00:00.000Z")),
    ).toEqual({
      startAt: "2026-04-17T07:00:00.000Z",
      endAt: "2027-07-17T07:00:00.000Z",
    });
    expect(
      fixedPacificCoverageWindow(new Date("2026-01-15T18:00:00.000Z")),
    ).toEqual({
      startAt: "2025-10-17T07:00:00.000Z",
      endAt: "2027-01-16T08:00:00.000Z",
    });
  });

  it("splits into exact adjacent half-open boundaries", () => {
    const parts = splitCoverageWindow({
      startAt: "2026-07-01T00:00:00.000Z",
      endAt: "2026-07-03T00:00:00.000Z",
    });
    expect(parts).toEqual([
      {
        startAt: "2026-07-01T00:00:00.000Z",
        endAt: "2026-07-02T00:00:00.000Z",
      },
      {
        startAt: "2026-07-02T00:00:00.000Z",
        endAt: "2026-07-03T00:00:00.000Z",
      },
    ]);
  });
});

describe("recursive coverage partitioning", () => {
  const root = {
    startAt: "2026-07-01T00:00:00.000Z",
    endAt: "2026-07-03T00:00:00.000Z",
  };

  it("splits a >50 page and persists only complete leaves", async () => {
    const fetchWindow = vi.fn(
      async (_token: string, window: typeof root): Promise<JobberCoveragePage> => {
        if (window.startAt === root.startAt && window.endAt === root.endAt) {
          return { nodes: Array.from({ length: 50 }, (_, index) =>
            visit(`overflow-${index}`, "2026-07-01T12:00:00.000Z")), hasNextPage: true };
        }
        const start = new Date(Date.parse(window.startAt) + 1).toISOString();
        return { nodes: [visit(window.startAt, start)], hasNextPage: false };
      },
    );
    const persistLeaf = vi.fn();
    const manifest = await crawlJobberCoveragePass({
      pass: 1,
      accessToken: "token",
      window: root,
      requestBudget: { count: 0, maximum: 10 },
      fetchWindow,
      beforeRequest: vi.fn().mockResolvedValue(undefined),
      persistLeaf,
    });
    expect(fetchWindow).toHaveBeenCalledTimes(3);
    expect(persistLeaf).toHaveBeenCalledTimes(2);
    expect(manifest.leaves).toHaveLength(2);
    expect(manifest.requestCount).toBe(3);
  });

  it("accepts an exact-50 complete leaf without splitting", async () => {
    const nodes = Array.from({ length: 50 }, (_, index) =>
      visit(`visit-${index}`, `2026-07-01T12:${String(index).padStart(2, "0")}:00.000Z`),
    );
    const fetchWindow = vi.fn().mockResolvedValue({
      nodes,
      hasNextPage: false,
    });
    const manifest = await crawlJobberCoveragePass({
      pass: 1,
      accessToken: "token",
      window: root,
      requestBudget: { count: 0, maximum: 2 },
      fetchWindow,
      beforeRequest: vi.fn().mockResolvedValue(undefined),
    });
    expect(fetchWindow).toHaveBeenCalledOnce();
    expect(manifest.leaves).toHaveLength(1);
    expect(manifest.visitCount).toBe(50);
  });

  it("assigns equal timestamps at a split boundary to the right half", async () => {
    const boundary = "2026-07-02T00:00:00.000Z";
    const fetchWindow = vi.fn(
      async (_token: string, window: typeof root): Promise<JobberCoveragePage> => {
        if (window.startAt === root.startAt && window.endAt === root.endAt) {
          return { nodes: [], hasNextPage: true };
        }
        return window.startAt === boundary
          ? {
              nodes: [visit("equal-a", boundary), visit("equal-b", boundary)],
              hasNextPage: false,
            }
          : { nodes: [], hasNextPage: false };
      },
    );
    const manifest = await crawlJobberCoveragePass({
      pass: 1,
      accessToken: "token",
      window: root,
      requestBudget: { count: 0, maximum: 4 },
      fetchWindow,
      beforeRequest: vi.fn().mockResolvedValue(undefined),
    });
    expect(manifest.visitCount).toBe(2);
    expect(manifest.leaves[1]?.observations.map((item) => item.externalVisitId))
      .toEqual(["equal-a", "equal-b"]);
  });

  it("aborts when the request cap is reached", async () => {
    await expect(
      crawlJobberCoveragePass({
        pass: 1,
        accessToken: "token",
        window: root,
        requestBudget: { count: 0, maximum: 1 },
        fetchWindow: vi.fn().mockResolvedValue({ nodes: [], hasNextPage: true }),
        beforeRequest: vi.fn().mockResolvedValue(undefined),
      }),
    ).rejects.toMatchObject({ code: "query_cap_reached" });
  });

  it("aborts an overflowing leaf at minimum safe granularity", async () => {
    await expect(
      crawlJobberCoveragePass({
        pass: 1,
        accessToken: "token",
        window: {
          startAt: "2026-07-01T00:00:00.000Z",
          endAt: "2026-07-01T00:00:00.001Z",
        },
        requestBudget: { count: 0, maximum: 2 },
        fetchWindow: vi.fn().mockResolvedValue({ nodes: [], hasNextPage: true }),
        beforeRequest: vi.fn().mockResolvedValue(undefined),
        minimumWindowMs: 1,
      }),
    ).rejects.toMatchObject({ code: "unsplittable_saturation" });
  });
});

describe("two-pass sync finalization", () => {
  const now = () => new Date("2026-07-16T18:00:00.000Z");
  const stableVisit = visit("stable", "2026-07-16T19:00:00.000Z");

  it("records the real actor and finalizes identical pass and leaf manifests", async () => {
    const store = persistence();
    const result = await runJobberCoverageSync(actor, store, {
      now,
      randomUuid: () => "00000000-0000-0000-0000-000000000038",
      getAccessToken: vi.fn().mockResolvedValue("token"),
      fetchWindow: vi.fn().mockResolvedValue({
        nodes: [stableVisit],
        hasNextPage: false,
      }),
    });
    expect(result.outcome).toBe("complete");
    expect(store.startOrResumeRun).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: actor.id }),
    );
    expect(store.completePass).toHaveBeenCalledTimes(2);
    expect(store.reserveNextWork).toHaveBeenCalledTimes(2);
    expect(store.finalizeRun).toHaveBeenCalledWith({
      runId: "00000000-0000-0000-0000-000000000038",
      actorId: actor.id,
      ownership: {
        acquisitionGeneration: 1,
        ownerToken: "00000000-0000-4000-8000-000000000001",
      },
      expectedWatermarkGeneration: 4,
    });
    expect(store.markPartial).not.toHaveBeenCalled();
  });

  it("marks a mismatched second pass partial and never finalizes", async () => {
    const store = persistence();
    const fetchWindow = vi.fn()
      .mockResolvedValueOnce({ nodes: [stableVisit], hasNextPage: false })
      .mockResolvedValueOnce({
        nodes: [{ ...stableVisit, visitStatus: "CHANGED" }],
        hasNextPage: false,
      });
    const result = await runJobberCoverageSync(actor, store, {
      now,
      getAccessToken: vi.fn().mockResolvedValue("token"),
      fetchWindow,
    });
    expect(result).toMatchObject({
      outcome: "partial",
      failureCode: "manifest_mismatch",
    });
    expect(store.finalizeRun).not.toHaveBeenCalled();
    expect(store.markPartial).toHaveBeenCalledWith(
      expect.objectContaining({ failureCode: "manifest_mismatch" }),
    );
  });

  it("returns a concurrent result before token or provider access", async () => {
    const getAccessToken = vi.fn();
    const store = persistence({
      startOrResumeRun: vi.fn().mockResolvedValue({
        outcome: "locked",
        runId: "00000000-0000-0000-0000-000000000138",
        acquisitionGeneration: null,
        ownerToken: null,
        watermarkGeneration: 2,
        window: fixedPacificCoverageWindow(now()),
        currentPass: 1,
        passReadyToComplete: false,
        requestCount: 3,
        leafCount: 1,
        visitCount: 0,
      }),
    });
    const result = await runJobberCoverageSync(actor, store, {
      now,
      getAccessToken,
    });
    expect(result.outcome).toBe("concurrent");
    expect(getAccessToken).not.toHaveBeenCalled();
    expect(store.recordLeaf).not.toHaveBeenCalled();
  });

  it("treats a transactional finalization replay as idempotent success", async () => {
    const store = persistence({
      finalizeRun: vi.fn().mockResolvedValue("replay"),
    });
    const result = await runJobberCoverageSync(actor, store, {
      now,
      getAccessToken: vi.fn().mockResolvedValue("token"),
      fetchWindow: vi.fn().mockResolvedValue({
        nodes: [stableVisit],
        hasNextPage: false,
      }),
    });
    expect(result.outcome).toBe("complete");
    expect(store.markPartial).not.toHaveBeenCalled();
  });

  it("reconciles durable completion when the finalize response is lost", async () => {
    const store = persistence({
      finalizeRun: vi.fn().mockRejectedValue(new Error("response lost")),
      reconcileFinalization: vi.fn().mockResolvedValue("completed"),
    });
    const result = await runJobberCoverageSync(actor, store, {
      now,
      getAccessToken: vi.fn().mockResolvedValue("token"),
      fetchWindow: vi.fn().mockResolvedValue({
        nodes: [stableVisit],
        hasNextPage: false,
      }),
    });
    expect(result).toMatchObject({ outcome: "complete", failureCode: null });
    expect(store.reconcileFinalization).toHaveBeenCalledWith({
      runId: result.runId,
    });
    expect(store.markPartial).not.toHaveBeenCalled();
  });

  it("keeps a rolled-back finalize indeterminate after an immediate not_completed read", async () => {
    let durableState: "running" | "partial" = "running";
    const store = persistence({
      finalizeRun: vi.fn().mockRejectedValue(new Error("transaction failed")),
      reconcileFinalization: vi.fn().mockResolvedValue("not_completed"),
      markPartial: vi.fn(async () => {
        durableState = "partial";
      }),
    });
    const result = await runJobberCoverageSync(actor, store, {
      now,
      getAccessToken: vi.fn().mockResolvedValue("token"),
      fetchWindow: vi.fn().mockResolvedValue({
        nodes: [stableVisit],
        hasNextPage: false,
      }),
    });
    expect(result).toMatchObject({
      outcome: "indeterminate",
      failureCode: "finalization_indeterminate",
    });
    expect(store.markPartial).not.toHaveBeenCalled();
    expect(durableState).toBe("running");
  });

  it("keeps an immediate not_completed read indeterminate when commit becomes visible later", async () => {
    let durableState: "running" | "complete" | "partial" = "running";
    let publishCommit: () => void = () => {
      throw new Error("finalize was not attempted");
    };
    const store = persistence({
      finalizeRun: vi.fn(async () => {
        publishCommit = () => {
          durableState = "complete";
        };
        throw new Error("finalize response lost before commit became visible");
      }),
      reconcileFinalization: vi.fn(async () => {
        expect(durableState).toBe("running");
        return "not_completed" as const;
      }),
      markPartial: vi.fn(async () => {
        durableState = "partial";
      }),
    });
    const result = await runJobberCoverageSync(actor, store, {
      now,
      getAccessToken: vi.fn().mockResolvedValue("token"),
      fetchWindow: vi.fn().mockResolvedValue({
        nodes: [stableVisit],
        hasNextPage: false,
      }),
    });
    expect(result).toMatchObject({
      outcome: "indeterminate",
      failureCode: "finalization_indeterminate",
    });
    expect(store.markPartial).not.toHaveBeenCalled();
    expect(durableState).toBe("running");
    publishCommit();
    expect(durableState).toBe("complete");
  });

  it("returns indeterminate without marking partial when finalize and reconciliation responses are both lost", async () => {
    let durableState: "running" | "complete" | "partial" = "running";
    const store = persistence({
      finalizeRun: vi.fn(async () => {
        durableState = "complete";
        throw new Error("finalize response lost after commit");
      }),
      reconcileFinalization: vi.fn().mockRejectedValue(
        new Error("reconciliation response lost"),
      ),
      markPartial: vi.fn(async () => {
        durableState = "partial";
      }),
    });
    const result = await runJobberCoverageSync(actor, store, {
      now,
      getAccessToken: vi.fn().mockResolvedValue("token"),
      fetchWindow: vi.fn().mockResolvedValue({
        nodes: [stableVisit],
        hasNextPage: false,
      }),
    });
    expect(result).toMatchObject({
      outcome: "indeterminate",
      failureCode: "finalization_indeterminate",
    });
    expect(store.finalizeRun).toHaveBeenCalledOnce();
    expect(store.reconcileFinalization).toHaveBeenCalledOnce();
    expect(store.markPartial).not.toHaveBeenCalled();
    expect(durableState).toBe("complete");
  });

  it("checkpoints exactly fourteen requests without making the run partial", async () => {
    const store = persistence();
    const fetchWindow = vi.fn().mockResolvedValue({
      nodes: [],
      hasNextPage: true,
    });
    const result = await runJobberCoverageSync(actor, store, {
      now,
      getAccessToken: vi.fn().mockResolvedValue("token"),
      fetchWindow,
    });
    expect(result).toMatchObject({
      outcome: "awaiting_continuation",
      failureCode: null,
      requestCount: JOBBER_COVERAGE_MAX_REQUESTS,
    });
    expect(store.pauseRun).toHaveBeenCalledWith({
      runId: result.runId,
      actorId: actor.id,
      ownership: {
        acquisitionGeneration: 1,
        ownerToken: "00000000-0000-4000-8000-000000000001",
      },
    });
    expect(store.markPartial).not.toHaveBeenCalled();
    expect(fetchWindow).toHaveBeenCalledTimes(JOBBER_COVERAGE_MAX_REQUESTS);
    expect(store.finalizeRun).not.toHaveBeenCalled();
  });

  it("resumes the same run and never re-fetches a completed leaf", async () => {
    const store = persistence();
    let providerCall = 0;
    let completedWindow: { startAt: string; endAt: string } | null = null;
    const fetchWindow = vi.fn(async (_token, requestedWindow) => {
      providerCall += 1;
      if (providerCall <= 13) return { nodes: [], hasNextPage: true };
      completedWindow ??= requestedWindow;
      return { nodes: [], hasNextPage: false };
    });
    const first = await runJobberCoverageSync(actor, store, {
      now,
      randomUuid: () => "00000000-0000-0000-0000-000000000238",
      getAccessToken: vi.fn().mockResolvedValue("token"),
      fetchWindow,
    });
    expect(first.outcome).toBe("awaiting_continuation");
    expect(first.requestCount).toBe(14);

    const second = await runJobberCoverageSync(actor, store, {
      now,
      randomUuid: () => "00000000-0000-0000-0000-000000000338",
      getAccessToken: vi.fn().mockResolvedValue("token"),
      fetchWindow,
      maximumRequests: 1,
    });
    expect(second).toMatchObject({
      outcome: "awaiting_continuation",
      runId: first.runId,
      requestCount: 15,
    });
    expect(fetchWindow.mock.calls[14]?.[1]).not.toEqual(completedWindow);
    expect(store.startOrResumeRun).toHaveBeenCalledTimes(2);
  });

  it("fails closed before provider access when durable attempt reservation loses authority", async () => {
    const store = persistence({
      reserveNextWork: vi.fn().mockRejectedValue(
        new Error("lease expired and was replaced"),
      ),
    });
    const fetchWindow = vi.fn();
    const result = await runJobberCoverageSync(actor, store, {
      now,
      getAccessToken: vi.fn().mockResolvedValue("token"),
      fetchWindow,
    });
    expect(result).toMatchObject({
      outcome: "partial",
      failureCode: "storage_failure",
      requestCount: 0,
    });
    expect(fetchWindow).not.toHaveBeenCalled();
    expect(store.finalizeRun).not.toHaveBeenCalled();
  });

  it("fails closed when durable leaf storage fails", async () => {
    const store = persistence({
      recordLeaf: vi.fn().mockRejectedValue(new Error("storage unavailable")),
    });
    const result = await runJobberCoverageSync(actor, store, {
      now,
      getAccessToken: vi.fn().mockResolvedValue("token"),
      fetchWindow: vi.fn().mockResolvedValue({
        nodes: [stableVisit],
        hasNextPage: false,
      }),
    });
    expect(result).toMatchObject({
      outcome: "partial",
      failureCode: "storage_failure",
    });
    expect(store.finalizeRun).not.toHaveBeenCalled();
  });
});
