import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  confirm: vi.fn(),
  append: vi.fn(),
}));

vi.mock("@/lib/auth/hq-route-authorization", () => ({
  authorizeHqApiRequest: mocks.authorize,
}));
vi.mock("@/lib/care-operations/jobber-visit-completion", async () => {
  const actual = await vi.importActual<
    typeof import("./jobber-visit-completion")
  >("./jobber-visit-completion");
  return {
    ...actual,
    confirmJobberVisitCompletion: mocks.confirm,
    appendVisitTextEvidence: mocks.append,
  };
});

import { POST as COMPLETE } from "../../app/api/admin/care-operations/jobber/visit-completions/route";
import { POST as EVIDENCE } from "../../app/api/admin/care-operations/jobber/visit-completions/evidence/route";
import { VisitCompletionError } from "./jobber-visit-completion";

const actor = {
  id: "00000000-0000-4000-8000-000000000434",
  email: "operator@example.invalid",
  role: "operator" as const,
};
const completionBody = {
  appointmentId: "00000000-0000-4000-8000-000000000431",
  projectionId: "00000000-0000-4000-8000-000000000432",
  sourcePayloadHash: "a".repeat(64),
  classificationId: "00000000-0000-4000-8000-000000000433",
  classificationUpdatedAt: "2026-07-19T17:05:00.000Z",
  propertyLinkUpdatedAt: "2026-07-18T17:05:00.000Z",
  reason: "Reviewed exact provider completion",
};

describe("authoritative visit completion routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue({ actor });
  });

  it.each([401, 403] as const)(
    "authorizes before parsing or completion work (%i)",
    async (status) => {
      mocks.authorize.mockResolvedValue({
        response: NextResponse.json({ error: "boundary" }, { status }),
      });
      const response = await COMPLETE(new Request("https://example.invalid", {
        method: "POST",
        body: "not json",
      }));
      expect(response.status).toBe(status);
      expect(mocks.confirm).not.toHaveBeenCalled();
    },
  );

  it("uses the authenticated actor and ignores browser property, membership, and actor ids", async () => {
    mocks.confirm.mockResolvedValue({ outcome: "completed" });
    const response = await COMPLETE(new Request("https://example.invalid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...completionBody,
        actorId: "browser-actor",
        propertyId: "browser-property",
        membershipId: "browser-membership",
      }),
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.confirm).toHaveBeenCalledWith({
      ...completionBody,
      actorId: actor.id,
    });
  });

  it("derives evidence scope from appointment and authenticated actor only", async () => {
    mocks.append.mockResolvedValue({ outcome: "recorded" });
    const body = {
      evidenceId: "00000000-0000-4000-8000-000000000435",
      appointmentId: completionBody.appointmentId,
      evidenceText: "Directly checked screens and sills.",
    };
    const response = await EVIDENCE(new Request("https://example.invalid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        actorId: "browser-actor",
        propertyId: "browser-property",
        membershipId: "browser-membership",
      }),
    }));
    expect(response.status).toBe(200);
    expect(mocks.append).toHaveBeenCalledWith({ ...body, actorId: actor.id });
  });

  it.each([400, 404, 409, 503] as const)(
    "returns an honest %i domain error",
    async (status) => {
      mocks.confirm.mockRejectedValue(new VisitCompletionError("held", status));
      const response = await COMPLETE(new Request("https://example.invalid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(completionBody),
      }));
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error: "held" });
    },
  );
});
