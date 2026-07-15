import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_COMPANY_SETTINGS } from "@/lib/pricing/company-settings";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  fetchSettings: vi.fn(),
}));

vi.mock("@/lib/pricing/pricing-settings-server", () => ({
  fetchPricingSettingsFromSupabase: mocks.fetchSettings,
}));
vi.mock("@/lib/presentations/repository", () => ({
  createPresentation: mocks.create,
  getPresentation: vi.fn(),
  patchPresentation: vi.fn(),
}));

import { createAuthorizedPresentation } from "./server-authoring";

describe("presentation server pricing authority", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchSettings.mockResolvedValue({
      settings: DEFAULT_COMPANY_SETTINGS,
      updatedAt: "2026-07-14T00:00:00.000Z",
      error: null,
    });
    mocks.create.mockImplementation(async (input) => ({ id: "presentation", ...input }));
  });

  it("persists an Atlas-derived immutable quote snapshot", async () => {
    await createAuthorizedPresentation(
      {
        authoringSource: "manual",
        clientName: "Alex Kim",
        pricing: {
          squareFeet: 2500,
          frequency: "quarterly",
          includeInterior: false,
          twoStory: false,
          includeScreens: false,
          exteriorAddOns: [],
        },
      },
      { id: "actor", email: "hq@example.com", role: "operator" },
    );

    const saved = mocks.create.mock.calls[0][0];
    expect(saved.quoteSnapshot.authority).toBe("atlas_pricing_engine_v1");
    expect(saved.quoteSnapshot.tierVisitPrices).toEqual({
      biannual: 312,
      quarterly: 250,
    });
    expect(saved.quoteSnapshot.tierEnrollmentSavings).toEqual({
      biannual: 100,
      quarterly: 162,
    });
    expect(saved.authoritySha256).toMatch(/^[0-9a-f]{64}$/);
    expect(saved).not.toHaveProperty("visitRateOverrides");
    expect(saved).not.toHaveProperty("monthlyRate");
  });
});
