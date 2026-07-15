import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { emptyHomeCarePlanDraft } from "@/lib/home-care-plan/create-types";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  save: vi.fn(),
}));

vi.mock("@/lib/auth/hq-route-authorization", () => ({
  authorizeHqApiRequest: mocks.authorize,
}));
vi.mock("@/lib/persistence/server/save-home-care-plan", () => ({
  saveHomeCarePlanFromAuthorizedDraft: mocks.save,
}));

import { POST } from "../../app/api/persistence/home-care-plans/route";

function validDraft() {
  return {
    ...emptyHomeCarePlanDraft,
    homeowner: {
      ...emptyHomeCarePlanDraft.homeowner,
      fullName: "Authorized Homeowner",
    },
    property: {
      ...emptyHomeCarePlanDraft.property,
      name: "Authorized Home",
      address: "1 Authority Way",
    },
  };
}

function request(body: unknown) {
  return new Request("https://homeatlas.example/api/persistence/home-care-plans", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("authenticated Home Care Plan persistence route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue({
      actor: { id: "actor-id", email: "operator@example.com", role: "operator" },
    });
    mocks.save.mockResolvedValue({ id: "stable-plan-id" });
  });

  it("authorizes before parsing or writing", async () => {
    mocks.authorize.mockResolvedValue({
      response: NextResponse.json({ error: "boundary" }, { status: 401 }),
    });
    const response = await POST(request({ draft: validDraft() }));
    expect(response.status).toBe(401);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("delegates a strict draft to the atomic server domain function", async () => {
    const response = await POST(request({ draft: validDraft() }));
    expect(response.status).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith(validDraft());
    await expect(response.json()).resolves.toEqual({
      record: { id: "stable-plan-id" },
    });
  });

  it("rejects extra route fields and invalid drafts", async () => {
    expect(
      (await POST(request({ draft: validDraft(), table: "homeowners" }))).status,
    ).toBe(400);
    expect((await POST(request({ draft: {} }))).status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("returns the same record on an authorized retry", async () => {
    const first = await POST(request({ draft: validDraft() }));
    const retry = await POST(request({ draft: validDraft() }));
    expect(await first.json()).toEqual(await retry.json());
    expect(mocks.save).toHaveBeenCalledTimes(2);
  });
});
