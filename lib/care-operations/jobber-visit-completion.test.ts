import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/lib/persistence/supabase/client", () => ({
  createServiceRoleSupabaseClient: () => ({ rpc: mocks.rpc }),
}));

import {
  appendVisitTextEvidence,
  assessJobberCompletionState,
  confirmJobberVisitCompletion,
  parseStrictProviderTimestamp,
} from "./jobber-visit-completion";

const ids = {
  appointmentId: "00000000-0000-4000-8000-000000000431",
  projectionId: "00000000-0000-4000-8000-000000000432",
  classificationId: "00000000-0000-4000-8000-000000000433",
  actorId: "00000000-0000-4000-8000-000000000434",
  evidenceId: "00000000-0000-4000-8000-000000000435",
};

describe("authoritative Jobber visit completion", () => {
  beforeEach(() => mocks.rpc.mockReset());

  it("requires the exact verified COMPLETED state, true flag, and coherent RFC3339 timestamp", () => {
    const valid = {
      visitStatus: "COMPLETED",
      isComplete: true,
      completedAt: "2026-07-19T17:00:00.000Z",
      sourceObservedAt: "2026-07-19T17:05:00.000Z",
      now: new Date("2026-07-19T17:10:00.000Z"),
    };
    expect(assessJobberCompletionState(valid)).toEqual({
      confirmable: true,
      reason: null,
    });
    for (const input of [
      { ...valid, visitStatus: "ACTIVE" },
      { ...valid, visitStatus: "UNKNOWN" },
      { ...valid, isComplete: false },
      { ...valid, completedAt: null },
      { ...valid, completedAt: "2026-02-30T17:00:00Z" },
      { ...valid, completedAt: "2026-07-19T17:06:00Z" },
      { ...valid, completedAt: "2026-07-19T17:11:00Z" },
    ]) {
      expect(assessJobberCompletionState(input).confirmable).toBe(false);
    }
    expect(parseStrictProviderTimestamp("2026-07-19 17:00:00Z")).toBeNull();
  });

  it("passes only reviewed identity tokens and the authenticated actor to one completion RPC", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        outcome: "completed",
        appointment_id: ids.appointmentId,
        completion_event_id: "00000000-0000-4000-8000-000000000436",
        completed_at: "2026-07-19T17:00:00.000Z",
        actor_id: ids.actorId,
      },
      error: null,
    });
    await confirmJobberVisitCompletion({
      ...ids,
      sourcePayloadHash: "a".repeat(64),
      classificationUpdatedAt: "2026-07-19T17:05:00.000Z",
      propertyLinkUpdatedAt: "2026-07-18T17:05:00.000Z",
      reason: "Reviewed exact provider completion",
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "confirm_jobber_visit_completion",
      {
        requested_appointment_id: ids.appointmentId,
        requested_projection_id: ids.projectionId,
        requested_source_payload_hash: "a".repeat(64),
        requested_classification_id: ids.classificationId,
        requested_classification_updated_at: "2026-07-19T17:05:00.000Z",
        requested_property_link_updated_at: "2026-07-18T17:05:00.000Z",
        requested_reason: "Reviewed exact provider completion",
        requested_actor_id: ids.actorId,
      },
    );
  });

  it("records idempotent text-only evidence without browser property or membership authority", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        outcome: "recorded",
        evidence_id: ids.evidenceId,
        appointment_id: ids.appointmentId,
        recorded_at: "2026-07-19T17:10:00.000Z",
      },
      error: null,
    });
    await appendVisitTextEvidence({
      evidenceId: ids.evidenceId,
      appointmentId: ids.appointmentId,
      evidenceText: "  Screens and sills were directly checked.  ",
      actorId: ids.actorId,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("append_visit_text_evidence", {
      requested_evidence_id: ids.evidenceId,
      requested_appointment_id: ids.appointmentId,
      requested_evidence_text: "Screens and sills were directly checked.",
      requested_actor_id: ids.actorId,
    });
  });

  it("maps stale or contradictory authority to conflict", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "completion_conflict: source changed" },
    });
    await expect(
      confirmJobberVisitCompletion({
        ...ids,
        sourcePayloadHash: "a".repeat(64),
        classificationUpdatedAt: "2026-07-19T17:05:00.000Z",
        propertyLinkUpdatedAt: "2026-07-18T17:05:00.000Z",
        reason: "Reviewed exact provider completion",
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("records the exact sanitized provider enum evidence and no token/customer data", () => {
    const fixture = JSON.parse(
      readFileSync(
        new URL("./fixtures/jobber-2025-04-16-schema.json", import.meta.url),
        "utf8",
      ),
    ) as {
      evidence: { visitStatus: Record<string, unknown> };
    };
    const visitStatus = fixture.evidence.visitStatus as {
      capturedAt: string;
      normalizedResultSha256: string;
      values: Array<Record<string, unknown>>;
    };
    expect(visitStatus).toMatchObject({
      enumValuesVerified: true,
      capturedAt: "2026-07-19T19:06:45.496Z",
      requestedApiVersion: "2025-04-16",
      containsTokenOrCustomerData: false,
      normalizedResultSha256:
        "15ac8d0817c3389023b52c8f3230278ee901d86a759d22444c54ffd73494221c",
      values: [
        { name: "ACTIVE", isDeprecated: false, deprecationReason: null },
        { name: "COMPLETED", isDeprecated: false, deprecationReason: null },
        { name: "LATE", isDeprecated: false, deprecationReason: null },
        { name: "TODAY", isDeprecated: false, deprecationReason: null },
        { name: "UNSCHEDULED", isDeprecated: false, deprecationReason: null },
      ],
    });
    expect(Number.isFinite(Date.parse(visitStatus.capturedAt))).toBe(true);
    expect(
      createHash("sha256")
        .update(JSON.stringify(visitStatus.values))
        .digest("hex"),
    ).toBe(visitStatus.normalizedResultSha256);
  });

  it("keeps money, publication, provider calls, images, and AI outside the application write path", () => {
    const source = readFileSync(
      new URL("./jobber-visit-completion.ts", import.meta.url),
      "utf8",
    );
    for (const forbidden of [
      "obligations",
      "atlas_pricing_snapshots",
      "billing_orders",
      "membership_billing_charges",
      "member_addon_transactions",
      "property_assets",
      "service_observations",
      "property_visit_health_checks",
      "openai",
      "stripe",
      "image",
    ]) {
      expect(source.toLowerCase()).not.toContain(forbidden);
    }
    expect(source).not.toMatch(/fetch\s*\(/);
  });
});
