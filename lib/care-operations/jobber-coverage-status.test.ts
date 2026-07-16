import { describe, expect, it } from "vitest";
import {
  buildJobberCoverageSyncStatus,
  deriveJobberCoverageState,
  type StoredCoverageRun,
} from "./jobber-coverage-store";

function run(
  id: string,
  status: StoredCoverageRun["status"],
  visitCount: number,
): StoredCoverageRun {
  return {
    id,
    status,
    actor_id: "2d9bfd32-1262-40af-9ce2-33f5710ed85b",
    window_start: "2026-04-17T07:00:00.000Z",
    window_end: "2027-07-17T07:00:00.000Z",
    failure_code: status === "partial" ? "storage_failure" : null,
    request_count: 2,
    leaf_count: 2,
    visit_count: visitCount,
    started_at: "2026-07-16T18:20:00.000Z",
    completed_at: status === "running" ? null : "2026-07-16T18:25:00.000Z",
  };
}

describe("Jobber coverage status", () => {
  const now = new Date("2026-07-16T18:30:00.000Z");

  it("is complete through the exact 30-minute threshold", () => {
    expect(
      deriveJobberCoverageState({
        latestRunStatus: "complete",
        coveredAt: "2026-07-16T18:00:00.000Z",
        now,
      }),
    ).toEqual({ coverageState: "complete", fresh: true });
  });

  it("shows partial when the latest attempt failed without erasing prior proof", () => {
    expect(
      deriveJobberCoverageState({
        latestRunStatus: "partial",
        coveredAt: "2026-07-16T18:20:00.000Z",
        now,
      }),
    ).toEqual({ coverageState: "partial", fresh: true });
  });

  it("is stale after 30 minutes or without a watermark", () => {
    expect(
      deriveJobberCoverageState({
        latestRunStatus: "complete",
        coveredAt: "2026-07-16T17:59:59.999Z",
        now,
      }),
    ).toEqual({ coverageState: "stale", fresh: false });
    expect(
      deriveJobberCoverageState({
        latestRunStatus: null,
        coveredAt: null,
        now,
      }),
    ).toEqual({ coverageState: "stale", fresh: false });
  });

  it("binds the verified visit count to watermark.run_id and separates a newer active run", () => {
    const verified = run("00000000-0000-0000-0000-000000000138", "complete", 7);
    const active = run("00000000-0000-0000-0000-000000000238", "running", 41);
    const status = buildJobberCoverageSyncStatus({
      latestRun: active,
      watermark: {
        run_id: verified.id,
        window_start: verified.window_start,
        window_end: verified.window_end,
        covered_at: "2026-07-16T18:25:00.000Z",
        generation: 5,
      },
      watermarkRun: verified,
      lock: {
        active_run_id: active.id,
        lease_expires_at: "2026-07-16T18:40:00.000Z",
      },
      activeRun: active,
      now,
    });
    expect(status.watermark).toMatchObject({
      runId: verified.id,
      visitCount: 7,
    });
    expect(status.latestRun?.visitCount).toBe(41);
    expect(status.inProgressRun).toMatchObject({ runId: active.id });
    expect(status.syncInProgress).toBe(true);
  });

  it("rejects a watermark whose identified durable run is not complete", () => {
    const wrongRun = run(
      "00000000-0000-0000-0000-000000000338",
      "partial",
      99,
    );
    expect(() => buildJobberCoverageSyncStatus({
      latestRun: wrongRun,
      watermark: {
        run_id: wrongRun.id,
        window_start: wrongRun.window_start,
        window_end: wrongRun.window_end,
        covered_at: "2026-07-16T18:25:00.000Z",
        generation: 6,
      },
      watermarkRun: wrongRun,
      lock: null,
      activeRun: null,
      now,
    })).toThrow("watermark run was inconsistent");
  });

  it("does not use a newer partial attempt's count for prior verified coverage", () => {
    const verified = run("00000000-0000-0000-0000-000000000438", "complete", 8);
    const partial = run("00000000-0000-0000-0000-000000000538", "partial", 77);
    const status = buildJobberCoverageSyncStatus({
      latestRun: partial,
      watermark: {
        run_id: verified.id,
        window_start: verified.window_start,
        window_end: verified.window_end,
        covered_at: "2026-07-16T18:25:00.000Z",
        generation: 7,
      },
      watermarkRun: verified,
      lock: null,
      activeRun: null,
      now,
    });
    expect(status.coverageState).toBe("partial");
    expect(status.latestRun?.visitCount).toBe(77);
    expect(status.watermark?.visitCount).toBe(8);
    expect(status.inProgressRun).toBeNull();
  });
});
