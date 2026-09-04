import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ lead: vi.fn(), presentation: vi.fn(), client: vi.fn() }));
vi.mock("@/lib/acquisition/leads/repository", () => ({ getLeadIntakeById: mocks.lead }));
vi.mock("@/lib/presentations/repository", () => ({ findAuthoritativePresentationForLeadIntake: mocks.presentation, getPresentation: vi.fn() }));
vi.mock("@/lib/admin/closed-jobs-server", () => ({ listClosedJobsFromSupabase: async () => ({ jobs: [] }) }));
vi.mock("@/lib/persistence/config", () => ({ isCloudPersistenceConnected: () => true }));
vi.mock("@/lib/persistence/supabase/client", () => ({ createServerSupabaseClient: mocks.client }));
import { loadCustomerWorkspace } from "./load-workspace";

describe("exact technician inquiry workspace", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.client.mockImplementation(() => { throw new Error("Unexpected fuzzy property lookup"); });
    mocks.lead.mockResolvedValue({ id: "original", name: "Shared household", email: "shared@example.com", serviceAddress: "123 Shared Street", servicesInterested: ["Window Cleaning"], source: "technician_referral", status: "new", notes: "Original referral notes", submittedAt: "2026-09-04T15:00:00Z", referredByTechnicianKey: "homeatlas:tyler", referredByTechnicianName: "Tyler Germany" });
  });
  it("keeps the original referral visible instead of redirecting by email/address", async () => {
    mocks.presentation.mockResolvedValue(null);
    const workspace = await loadCustomerWorkspace("lead", "original");
    expect(workspace).toMatchObject({ ref: { type: "lead", id: "original" }, canonical: null, notes: "Original referral notes", technicianReferralCredit: { technicianName: "Tyler Germany", leadId: "original", presentationId: null } });
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("carries exact credit into the signed-plan handoff without claiming payment", async () => {
    mocks.presentation.mockResolvedValue({ id: "signed-plan", status: "signed", updatedAt: "2026-09-04T16:00:00Z" });
    const workspace = await loadCustomerWorkspace("lead", "original");
    expect(workspace).toMatchObject({ stage: "onboarding", membership: null, technicianReferralCredit: { leadId: "original", presentationId: "signed-plan" } });
    expect(workspace?.actions).toContainEqual(expect.objectContaining({ href: "/presentations/signed-plan/present", label: "Continue onboarding" }));
    expect(mocks.presentation).toHaveBeenCalledExactlyOnceWith({ leadIntakeId: "original" });
  });
});
