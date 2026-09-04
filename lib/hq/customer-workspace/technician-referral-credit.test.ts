import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { LeadIntakeRecord } from "@/lib/acquisition/lead-record";
import { technicianReferralCredit } from "./technician-referral-credit";

const mocks = vi.hoisted(() => ({ lead: vi.fn(), presentation: vi.fn(), eq: vi.fn(), connected: vi.fn() }));
vi.mock("@/lib/acquisition/leads/repository", () => ({ getLeadIntakeById: mocks.lead }));
vi.mock("@/lib/persistence/config", () => ({ isCloudPersistenceConnected: mocks.connected }));
vi.mock("@/lib/persistence/supabase/client", () => ({ createServerSupabaseClient: () => ({
  from: (table: string) => { expect(table).toBe("presentations"); return {
    select: (fields: string) => { expect(fields).toBe("id, lead_intake_id"); return {
      eq: (key: string, value: string) => { mocks.eq(key, value); return { maybeSingle: mocks.presentation }; },
    }; },
  }; },
}) }));
import { loadPresentationTechnicianReferralCredit } from "./technician-referral-credit-server";

const lead = {
  id: "original-inquiry", source: "technician_referral", submittedAt: "2026-09-04T15:00:00Z",
  referredByTechnicianKey: "homeatlas:technician-one", referredByTechnicianName: "Tyler Germany",
} as LeadIntakeRecord;

describe("owner technician referral credit", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.connected.mockReturnValue(true); });

  it("shows server-stamped credit without claiming earnings or exposing the technician key", () => {
    expect(technicianReferralCredit(lead)).toEqual({ status: "recorded", technicianName: "Tyler Germany", leadId: lead.id, submittedAt: lead.submittedAt, presentationId: null });
  });
  it("does not credit a different source with stray metadata", () => {
    expect(technicianReferralCredit({ ...lead, source: "request_form" })).toBeNull();
  });
  it.each(["referredByTechnicianKey", "referredByTechnicianName"] as const)("flags missing %s rather than inventing credit", key => {
    expect(technicianReferralCredit({ ...lead, [key]: " " })).toEqual({ status: "unavailable" });
  });
  it("follows the exact presentation -> inquiry link", async () => {
    mocks.presentation.mockResolvedValue({ data: { id: "sold-plan", lead_intake_id: lead.id }, error: null });
    mocks.lead.mockResolvedValue(lead);
    expect(await loadPresentationTechnicianReferralCredit("sold-plan")).toMatchObject({ technicianName: "Tyler Germany", presentationId: "sold-plan", leadId: lead.id });
    expect(mocks.eq).toHaveBeenCalledExactlyOnceWith("id", "sold-plan");
    expect(mocks.lead).toHaveBeenCalledExactlyOnceWith(lead.id);
  });
  it("does not search by name or email when the presentation has no intake link", async () => {
    mocks.presentation.mockResolvedValue({ data: { id: "manual-plan", lead_intake_id: null }, error: null });
    expect(await loadPresentationTechnicianReferralCredit("manual-plan")).toBeNull();
    expect(mocks.lead).not.toHaveBeenCalled();
  });
  it("avoids reads without a presentation", async () => {
    expect(await loadPresentationTechnicianReferralCredit(null)).toBeNull();
    expect(mocks.presentation).not.toHaveBeenCalled();
  });
  it("makes missing linked data explicit", async () => {
    mocks.presentation.mockResolvedValue({ data: { id: "sold-plan", lead_intake_id: lead.id }, error: null });
    mocks.lead.mockResolvedValue(null);
    expect(await loadPresentationTechnicianReferralCredit("sold-plan")).toEqual({ status: "unavailable" });
  });
  it("contains read failures without hiding them as no referral", async () => {
    mocks.presentation.mockRejectedValue(new Error("private database detail"));
    expect(await loadPresentationTechnicianReferralCredit("sold-plan")).toEqual({ status: "unavailable" });
  });
  it("does not use a stale local presentation when cloud persistence is unavailable", async () => {
    mocks.connected.mockReturnValue(false);
    expect(await loadPresentationTechnicianReferralCredit("sold-plan")).toEqual({ status: "unavailable" });
    expect(mocks.presentation).not.toHaveBeenCalled();
  });
  it("handles Supabase error responses as unavailable", async () => {
    mocks.presentation.mockResolvedValue({ data: null, error: { message: "private query detail" } });
    expect(await loadPresentationTechnicianReferralCredit("sold-plan")).toEqual({ status: "unavailable" });
    expect(mocks.lead).not.toHaveBeenCalled();
  });
  it("the property workspace prefers membership lineage over a newer draft or email match", () => {
    const source = readFileSync("lib/hq/customer-workspace/load-workspace.ts", "utf8");
    expect(source).toContain('(membership?.presentation_id as string | null) ?? presentation?.id');
    expect(source).toContain("technicianReferralCredit: referralCredit");
    expect(source).not.toContain("technicianReferralCredit(leadMatch");
  });
});
