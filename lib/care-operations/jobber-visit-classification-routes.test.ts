import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  decide: vi.fn(),
  revoke: vi.fn(),
  load: vi.fn(),
}));

vi.mock("@/lib/auth/hq-route-authorization", () => ({
  authorizeHqApiRequest: mocks.authorize,
}));
vi.mock("@/lib/care-operations/jobber-visit-classification", async () => {
  const actual = await vi.importActual<
    typeof import("./jobber-visit-classification")
  >("./jobber-visit-classification");
  return {
    ...actual,
    decideJobberVisitClassification: mocks.decide,
    revokeJobberVisitClassification: mocks.revoke,
    loadJobberVisitClassificationWorkspace: mocks.load,
  };
});

import {
  GET,
  POST,
} from "../../app/api/admin/care-operations/jobber/visit-classifications/route";
import { POST as REVOKE } from "../../app/api/admin/care-operations/jobber/visit-classifications/revoke/route";
import { VisitClassificationError } from "./jobber-visit-classification";

const actor = {
  id: "00000000-0000-4000-8000-000000000305",
  email: "operator@example.invalid",
  role: "operator" as const,
};
const body = {
  action: "approve",
  projectionId: "00000000-0000-4000-8000-000000000301",
  sourcePayloadHash: "a".repeat(64),
  propertyLinkId: "00000000-0000-4000-8000-000000000302",
  propertyLinkUpdatedAt: "2026-07-16T20:00:00.000Z",
  membershipId: "00000000-0000-4000-8000-000000000303",
  propertyId: "00000000-0000-4000-8000-000000000304",
  serviceType: "home_care_visit",
  reason: "Reviewed exact source and property",
};

describe("Jobber visit-classification routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue({ actor });
  });

  it.each([
    [401, "unauthenticated"],
    [403, "inactive HQ actor"],
    [403, "revoked HQ actor"],
  ])("returns %i for %s before any classification work", async (status) => {
    mocks.authorize.mockResolvedValue({
      response: NextResponse.json({ error: "boundary" }, { status }),
    });
    const response = await POST(
      new Request("https://homeatlas.example/api/admin/care-operations/jobber/visit-classifications", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
    expect(response.status).toBe(status);
    expect(mocks.decide).not.toHaveBeenCalled();
  });

  it("records the authenticated actor UUID, not a browser-supplied identity", async () => {
    mocks.decide.mockResolvedValue({
      outcome: "approved",
      classification_id: "classification-1",
      appointment_id: "appointment-1",
    });
    const response = await POST(
      new Request("https://homeatlas.example/api/admin/care-operations/jobber/visit-classifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, actorId: "browser-actor" }),
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.decide).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: actor.id }),
    );
  });

  it("keeps the listing uncached and authorization-first", async () => {
    mocks.load.mockResolvedValue({ visits: [] });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.authorize).toHaveBeenCalledBefore(mocks.load);
  });

  it("passes the authenticated actor to revocation", async () => {
    mocks.revoke.mockResolvedValue({
      outcome: "revoked",
      classification_id: "classification-1",
      appointment_id: "appointment-1",
    });
    const response = await REVOKE(
      new Request("https://homeatlas.example/api/admin/care-operations/jobber/visit-classifications/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classificationId: "00000000-0000-4000-8000-000000000306",
          expectedUpdatedAt: "2026-07-16T20:00:00.000Z",
          reason: "Approval no longer applies",
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.revoke).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: actor.id }),
    );
  });

  it.each([400, 404, 409, 503] as const)(
    "returns an honest %i classification error",
    async (status) => {
      mocks.decide.mockRejectedValue(
        new VisitClassificationError("classification failed", status),
      );
      const response = await POST(
        new Request("https://homeatlas.example/api/admin/care-operations/jobber/visit-classifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error: "classification failed" });
    },
  );
});
