import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  matching: vi.fn(),
  coverage: vi.fn(),
}));

vi.mock("@/lib/persistence/supabase/client", () => ({
  createServiceRoleSupabaseClient: () => ({ rpc: mocks.rpc, from: mocks.from }),
}));
vi.mock("./jobber-property-matching", () => ({
  loadJobberPropertyMatchingWorkspace: mocks.matching,
}));
vi.mock("./jobber-coverage-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./jobber-coverage-store")>()),
  readJobberCoverageSyncStatus: mocks.coverage,
}));

import {
  assessVisitPromotion,
  decideJobberVisitClassification,
  loadJobberVisitClassificationWorkspace,
} from "./jobber-visit-classification";
import {
  buildJobberCoverageSyncStatus,
  type StoredCoverageRun,
} from "./jobber-coverage-store";
import { appointmentBusinessCalendarDate } from "@/lib/admin/company-business-timezone";
import { buildScheduleFromAppointments } from "@/lib/membership/member-schedule";

const ids = {
  projectionId: "00000000-0000-4000-8000-000000000301",
  propertyLinkId: "00000000-0000-4000-8000-000000000302",
  membershipId: "00000000-0000-4000-8000-000000000303",
  propertyId: "00000000-0000-4000-8000-000000000304",
  actorId: "00000000-0000-4000-8000-000000000305",
};

const decision = {
  action: "approve" as const,
  ...ids,
  sourcePayloadHash: "a".repeat(64),
  propertyLinkUpdatedAt: "2026-07-16T20:00:00.000Z",
  serviceType: "home_care_visit",
  reason: "Reviewed exact visit and property link",
};

describe("supervised Jobber visit classification", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
  });

  it("promotes only an unambiguously future UPCOMING provider record", () => {
    const now = new Date("2026-07-16T20:00:00.000Z");
    expect(
      assessVisitPromotion({
        visitStatus: "UPCOMING",
        isComplete: false,
        completedAt: null,
        scheduledStart: "2026-07-17T20:00:00.000Z",
        now,
      }).promotable,
    ).toBe(true);
    for (const input of [
      { visitStatus: "UNKNOWN", isComplete: false, completedAt: null, scheduledStart: "2026-07-17T20:00:00Z" },
      { visitStatus: "UPCOMING", isComplete: true, completedAt: null, scheduledStart: "2026-07-17T20:00:00Z" },
      { visitStatus: "UPCOMING", isComplete: false, completedAt: "2026-07-16T19:00:00Z", scheduledStart: "2026-07-17T20:00:00Z" },
      { visitStatus: "UPCOMING", isComplete: false, completedAt: null, scheduledStart: null },
      { visitStatus: "UPCOMING", isComplete: false, completedAt: null, scheduledStart: "2026-07-15T20:00:00Z" },
    ]) {
      expect(assessVisitPromotion({ ...input, now }).promotable).toBe(false);
    }
  });

  it("passes the real actor and every reviewed token to one atomic RPC", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        outcome: "approved",
        classification_id: "classification-1",
        appointment_id: "appointment-1",
      },
      error: null,
    });

    await expect(decideJobberVisitClassification(decision)).resolves.toMatchObject({
      outcome: "approved",
      appointment_id: "appointment-1",
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "decide_jobber_visit_classification",
      expect.objectContaining({
        requested_actor_id: ids.actorId,
        requested_projection_id: ids.projectionId,
        requested_source_payload_hash: "a".repeat(64),
        requested_property_link_id: ids.propertyLinkId,
        requested_property_link_updated_at: decision.propertyLinkUpdatedAt,
        requested_membership_id: ids.membershipId,
        requested_property_id: ids.propertyId,
        requested_service_type: "home_care_visit",
      }),
    );
  });

  it("accepts only the shared HomeAtlas service allowlist, never a Jobber title", async () => {
    await expect(
      decideJobberVisitClassification({
        ...decision,
        serviceType: "Premium Jobber Window Package",
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("maps stale source or link evidence to a 409-equivalent conflict", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "classification_conflict: Jobber visit source changed" },
    });
    await expect(decideJobberVisitClassification(decision)).rejects.toMatchObject({
      status: 409,
    });
  });

  it("keeps forbidden domains outside the application write path", () => {
    const source = readFileSync(
      new URL("./jobber-visit-classification.ts", import.meta.url),
      "utf8",
    );
    for (const table of [
      "obligations",
      "atlas_pricing_snapshots",
      "billing_orders",
      "membership_billing_charges",
      "member_addon_transactions",
      "property_assets",
      "service_observations",
    ]) {
      expect(source).not.toContain(`.from(\"${table}\")`);
    }
    expect(source).not.toMatch(/stripe/i);
    expect(source).not.toMatch(/fetch\s*\(/);
  });

  it.each([
    ["partial", false, false],
    ["stale", false, false],
    ["complete", true, true],
  ] as const)(
    "blocks decisions for %s coverage with fresh=%s and syncInProgress=%s",
    async (coverageState, fresh, syncInProgress) => {
    mocks.matching.mockResolvedValue({
      visitLimitReached: false,
      visits: [
        {
          projectionId: ids.projectionId,
          visitStatus: "UPCOMING",
          isComplete: false,
          completedAt: null,
          scheduledStart: "2026-07-17T20:00:00.000Z",
          propertyClassification: "homeatlas_member_property",
          propertyLink: {
            linkState: "active",
            membershipActive: true,
          },
        },
      ],
    });
    mocks.coverage.mockResolvedValue({
      coverageState,
      fresh,
      syncInProgress,
      watermark: { coveredAt: "2026-07-16T19:00:00.000Z" },
    });
    mocks.from.mockReturnValue({
      select: () => ({
        in: async () => ({ data: [], error: null }),
      }),
    });

    const workspace = await loadJobberVisitClassificationWorkspace(
      new Date("2026-07-16T20:00:00.000Z"),
    );

    expect(workspace.coverage).toMatchObject({
      state: coverageState,
      fresh,
      decisionsEnabled: false,
      routeCompletenessClaimed: false,
    });
    expect(workspace.visits[0]?.promotionReadiness).toBe("coverage_not_ready");
    },
  );

  it("enables review only for complete fresh coverage with no sync in progress", async () => {
    mocks.matching.mockResolvedValue({
      visitLimitReached: false,
      visits: [
        {
          projectionId: ids.projectionId,
          visitStatus: "UPCOMING",
          isComplete: false,
          completedAt: null,
          scheduledStart: "2026-07-17T20:00:00.000Z",
          propertyClassification: "homeatlas_member_property",
          propertyLink: { linkState: "active", membershipActive: true },
        },
      ],
    });
    mocks.coverage.mockResolvedValue({
      coverageState: "complete",
      fresh: true,
      syncInProgress: false,
      watermark: { coveredAt: "2026-07-16T19:50:00.000Z" },
    });
    mocks.from.mockReturnValue({
      select: () => ({
        in: async () => ({ data: [], error: null }),
      }),
    });

    const workspace = await loadJobberVisitClassificationWorkspace(
      new Date("2026-07-16T20:00:00.000Z"),
    );
    expect(workspace.coverage.decisionsEnabled).toBe(true);
    expect(workspace.visits[0]?.promotionReadiness).toBe("ready_for_review");
  });

  it("keeps review disabled when a newer unfinished run has no current lease over an older fresh watermark", async () => {
    const completeRun: StoredCoverageRun = {
      id: "00000000-0000-4000-8000-000000000401",
      reservation_sequence: 401,
      status: "complete",
      actor_id: ids.actorId,
      window_start: "2026-04-17T07:00:00.000Z",
      window_end: "2027-07-17T07:00:00.000Z",
      failure_code: null,
      request_count: 2,
      leaf_count: 2,
      visit_count: 7,
      started_at: "2026-07-16T19:00:00.000Z",
      completed_at: "2026-07-16T19:10:00.000Z",
    };
    const unfinishedRun: StoredCoverageRun = {
      ...completeRun,
      id: "00000000-0000-4000-8000-000000000402",
      status: "running",
      started_at: "2026-07-16T19:40:00.000Z",
      completed_at: null,
    };
    const coverage = buildJobberCoverageSyncStatus({
      latestRun: unfinishedRun,
      watermark: {
        run_id: completeRun.id,
        window_start: completeRun.window_start,
        window_end: completeRun.window_end,
        covered_at: "2026-07-16T19:50:00.000Z",
        generation: 3,
      },
      watermarkRun: completeRun,
      lock: {
        active_run_id: unfinishedRun.id,
        lease_expires_at: "2026-07-16T19:59:59.999Z",
      },
      activeRun: null,
      now: new Date("2026-07-16T20:00:00.000Z"),
    });
    mocks.matching.mockResolvedValue({
      visitLimitReached: false,
      visits: [
        {
          projectionId: ids.projectionId,
          visitStatus: "UPCOMING",
          isComplete: false,
          completedAt: null,
          scheduledStart: "2026-07-17T20:00:00.000Z",
          propertyClassification: "homeatlas_member_property",
          propertyLink: { linkState: "active", membershipActive: true },
        },
      ],
    });
    mocks.coverage.mockResolvedValue(coverage);
    mocks.from.mockReturnValue({
      select: () => ({
        in: async () => ({ data: [], error: null }),
      }),
    });

    const workspace = await loadJobberVisitClassificationWorkspace(
      new Date("2026-07-16T20:00:00.000Z"),
    );

    expect(coverage).toMatchObject({
      coverageState: "stale",
      fresh: true,
      syncInProgress: false,
    });
    expect(workspace.coverage.decisionsEnabled).toBe(false);
    expect(workspace.visits[0]?.promotionReadiness).toBe("coverage_not_ready");
  });

  it("uses one appointment instant and the Pacific date in both HQ and portal views", () => {
    const scheduledAt = "2026-07-10T01:30:00.000Z";
    const portal = buildScheduleFromAppointments({
      appointments: [
        {
          id: "appointment-1",
          date: scheduledAt,
          serviceType: "home_care_visit",
          technician: null,
          notes: null,
          status: "scheduled",
        },
      ],
      monthlyPrice: 0,
      referenceDate: new Date("2026-07-09T12:00:00.000Z"),
    });
    expect(appointmentBusinessCalendarDate(scheduledAt)).toBe("2026-07-09");
    expect(portal.items[0]).toMatchObject({
      id: "appointment-1",
      scheduledDate: "July 9, 2026",
    });
  });
});
