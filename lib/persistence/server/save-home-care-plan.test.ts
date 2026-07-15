import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyHomeCarePlanDraft } from "@/lib/home-care-plan/create-types";
import { DEFAULT_COMPANY_SETTINGS } from "@/lib/pricing/company-settings";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  single: vi.fn(),
  fetchSettings: vi.fn(),
}));

vi.mock("@/lib/pricing/pricing-settings-server", () => ({
  fetchPricingSettingsFromSupabase: mocks.fetchSettings,
}));
vi.mock("@/lib/persistence/supabase/client", () => ({
  createServiceRoleSupabaseClient: () => ({
    rpc: mocks.rpc,
  }),
}));
vi.mock("@/lib/persistence/supabase/mappers", () => ({
  homeCarePlanFromRow: (row: unknown) => row,
}));

import { saveHomeCarePlanFromAuthorizedDraft } from "./save-home-care-plan";

describe("Home Care Plan server persistence authority", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchSettings.mockResolvedValue({
      settings: DEFAULT_COMPANY_SETTINGS,
      updatedAt: null,
      error: null,
    });
    mocks.single.mockResolvedValue({ data: { id: "plan" }, error: null });
    mocks.rpc.mockReturnValue({ single: mocks.single });
  });

  it("persists blank property facts as unknown and omits visit-history authority", async () => {
    const draft = {
      ...emptyHomeCarePlanDraft,
      homeowner: { ...emptyHomeCarePlanDraft.homeowner, fullName: "Alex Kim" },
      property: {
        ...emptyHomeCarePlanDraft.property,
        name: "Kim Home",
        address: "1 Oak Way",
        yearBuilt: "",
        homeCareScore: "",
        lastVisit: "",
      },
    };

    await saveHomeCarePlanFromAuthorizedDraft(draft);
    const [functionName, input] = mocks.rpc.mock.calls[0];
    expect(functionName).toBe("save_hq_home_care_plan");
    expect(input.p_property_home_care_score).toBeNull();
    expect(input.p_property_year_built).toBeNull();
    expect(input).not.toHaveProperty("p_property_last_visit");
    expect(input.p_homeowner_slug).toMatch(/^alex-kim-[0-9a-f]{16}$/);
    expect(input.p_property_slug).toMatch(/^kim-home-[0-9a-f]{16}$/);
  });
});
