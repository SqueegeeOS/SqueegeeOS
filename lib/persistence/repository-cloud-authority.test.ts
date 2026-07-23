import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildHomeCarePlanFromDraft } from "@/lib/home-care-plan/builder";
import { emptyHomeCarePlanDraft } from "@/lib/home-care-plan/create-types";

const { sessionSave, sessionGet, cloudGet } = vi.hoisted(() => ({
  sessionSave: vi.fn(),
  sessionGet: vi.fn(),
  cloudGet: vi.fn(),
}));

vi.mock("./config", () => ({
  getActivePersistenceBackend: () => "supabase",
  isCloudPersistenceConnected: () => true,
}));

vi.mock("./adapters/session-storage", () => ({
  membershipAgreementToSignedAgreement: vi.fn(),
  sessionStorageAdapter: {
    backend: "session",
    saveHomeCarePlan: sessionSave,
    getHomeCarePlanBySlugs: sessionGet,
  },
}));

vi.mock("./adapters/supabase", () => ({
  supabaseAdapter: {
    backend: "supabase",
    getHomeCarePlanBySlugs: cloudGet,
  },
}));

describe("configured cloud persistence authority", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fails closed when the authorized Supabase save fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "database unavailable" }),
      }),
    );
    const draft = {
      ...emptyHomeCarePlanDraft,
      homeowner: { ...emptyHomeCarePlanDraft.homeowner, fullName: "Alex Kim" },
      property: {
        ...emptyHomeCarePlanDraft.property,
        name: "Kim Home",
        address: "1 Oak Way",
      },
    };
    const presentation = buildHomeCarePlanFromDraft(draft);
    const { saveGeneratedHomeCarePlan } = await import("./repository");

    await expect(saveGeneratedHomeCarePlan(presentation, draft)).rejects.toThrow(
      "database unavailable",
    );
    expect(sessionSave).not.toHaveBeenCalled();
  });

  it("does not present a local mirror as cloud truth when cloud has no record", async () => {
    cloudGet.mockResolvedValue(null);
    sessionGet.mockResolvedValue({ presentation: {} });
    const { loadGeneratedHomeCarePlan } = await import("./repository");

    await expect(loadGeneratedHomeCarePlan("alex", "home")).resolves.toBeNull();
    expect(sessionGet).not.toHaveBeenCalled();
  });
});
