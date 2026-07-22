import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const CAPABILITY = "43f4f95d-cae4-4f68-b672-29d56d6f7b5f";
const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  getByCapability: vi.fn(),
  list: vi.fn(),
  markPresented: vi.fn(),
  patch: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/lib/auth/hq-route-authorization", () => ({
  authorizeHqApiRequest: mocks.authorize,
}));
vi.mock("@/lib/presentations/repository", () => ({
  getPresentationByCapability: mocks.getByCapability,
  listPresentations: mocks.list,
  markPresentationPresentedByCapability: mocks.markPresented,
}));
vi.mock("@/lib/presentations/server-authoring", () => ({
  createAuthorizedPresentation: mocks.create,
  patchAuthorizedPresentation: mocks.patch,
  PresentationAuthoringError: class PresentationAuthoringError extends Error {
    status = 400;
  },
}));

import { GET, PATCH } from "../../app/api/presentations/[id]/route";
import { POST } from "../../app/api/presentations/route";

const context = { params: Promise.resolve({ id: CAPABILITY }) };

function patchRequest(body: unknown) {
  return new NextRequest(`https://homeatlas.example/api/presentations/${CAPABILITY}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createRequest(body: unknown) {
  return new NextRequest("https://homeatlas.example/api/presentations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const actor = { id: "actor-id", email: "hq@example.com", role: "operator" };

describe("public presentation capability route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getByCapability.mockResolvedValue({ id: CAPABILITY, status: "draft" });
    mocks.markPresented.mockResolvedValue({
      id: CAPABILITY,
      status: "presented",
    });
    mocks.patch.mockResolvedValue({ id: CAPABILITY, status: "draft" });
    mocks.create.mockResolvedValue({ id: CAPABILITY, status: "draft" });
    mocks.authorize.mockResolvedValue({
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
  });

  it("loads only through the server-established capability resolver", async () => {
    const response = await GET(
      new NextRequest(`https://homeatlas.example/api/presentations/${CAPABILITY}`),
      context,
    );
    expect(response.status).toBe(200);
    expect(mocks.getByCapability).toHaveBeenCalledWith(CAPABILITY);
  });

  it("allows only the exact public draft-to-presented operation", async () => {
    const response = await PATCH(patchRequest({ status: "presented" }), context);
    expect(response.status).toBe(200);
    expect(mocks.markPresented).toHaveBeenCalledWith(CAPABILITY);
    expect(mocks.authorize).not.toHaveBeenCalled();
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it("requires the PR1a actor for every content edit", async () => {
    const response = await PATCH(
      patchRequest({ status: "presented", clientName: "Injected" }),
      context,
    );
    expect(response.status).toBe(401);
    expect(mocks.authorize).toHaveBeenCalledOnce();
    expect(mocks.markPresented).not.toHaveBeenCalled();
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it.each([
    { status: "signed" },
    { agreementId: crypto.randomUUID() },
    { membershipId: crypto.randomUUID() },
    { homeownerId: crypto.randomUUID() },
    { propertyId: crypto.randomUUID() },
    { signedAt: new Date().toISOString() },
    { monthlyRate: 1 },
    { visitRateOverrides: { quarterly: 1 } },
    { quoteSnapshot: { windowCareVisitPrice: 1 } },
    { id: crypto.randomUUID() },
  ])("rejects malicious PATCH authority without touching the record: %o", async (field) => {
    mocks.authorize.mockResolvedValue({ actor });
    const response = await PATCH(patchRequest(field), context);
    expect(response.status).toBe(400);
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it("accepts only explicit authorable PATCH fields", async () => {
    mocks.authorize.mockResolvedValue({ actor });
    const response = await PATCH(
      patchRequest({ clientName: "Authorized", homeSqft: 2500 }),
      context,
    );
    expect(response.status).toBe(200);
    expect(mocks.patch).toHaveBeenCalledWith(CAPABILITY, {
      clientName: "Authorized",
      homeSqft: 2500,
    });
  });

  it.each([
    { createdBy: "attacker" },
    { status: "signed" },
    { agreementId: crypto.randomUUID() },
    { homeownerId: crypto.randomUUID() },
    { monthlyRate: 1 },
    { quoteSnapshot: { windowCareVisitPrice: 1 } },
  ])("rejects malicious POST authority without creating a record: %o", async (field) => {
    mocks.authorize.mockResolvedValue({ actor });
    const response = await POST(
      createRequest({
        authoringSource: "manual",
        pricing: {
          squareFeet: 2500,
          frequency: "quarterly",
          includeInterior: false,
          twoStory: false,
          includeScreens: false,
          exteriorAddOns: [],
        },
        ...field,
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
