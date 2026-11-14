import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({
  ensure: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/communications/repository", () => ({ ensureHomeownerConversation: mocks.ensure }));
vi.mock("@/lib/persistence/supabase/client", () => ({ createServiceRoleSupabaseClient: () => ({ rpc: mocks.rpc }) }));
import { recordSignTogetherReminderConsent } from "./sign-together-reminder-consent";
import { enrollmentReminderPhone } from "./visit-reminder-consent";
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.ensure.mockResolvedValue({ id: "conversation" });
  mocks.rpc.mockResolvedValue({ error: null });
});

describe("sign-together visit reminder consent", () => {
  it("does nothing when the optional checkbox was not selected", async () => {
    await recordSignTogetherReminderConsent({ agreementId: "a", homeownerId: "h", phone: null });
    expect(mocks.ensure).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("binds consent to the saved agreement and exact customer number", async () => {
    await recordSignTogetherReminderConsent({ agreementId: "a", homeownerId: "h", phone: "+15305551234" });
    expect(mocks.ensure).toHaveBeenCalledWith({ homeownerId: "h", subject: "Service visit updates" });
    expect(mocks.rpc).toHaveBeenCalledWith("record_signed_agreement_visit_sms_consent", {
      p_agreement_id: "a", p_conversation_id: "conversation", p_address_normalized: "+15305551234",
    });
  });
  it("reports failures without exposing backend details", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "private internals" } });
    await expect(recordSignTogetherReminderConsent({ agreementId: "a", homeownerId: "h", phone: "+15305551234" }))
      .rejects.toThrow("Visit text consent could not be recorded safely.");
  });
  it("validates phone input only for explicit opt-in and uses the displayed stored number", () => {
    expect(enrollmentReminderPhone({ packetPhone: null, enteredPhone: "bad", optedIn: false })).toBeNull();
    expect(() => enrollmentReminderPhone({ packetPhone: null, enteredPhone: "bad", optedIn: true })).toThrow();
    expect(enrollmentReminderPhone({ packetPhone: "530-555-1234", enteredPhone: "415-555-1000", optedIn: true })).toBe("+15305551234");
  });
  it("keeps the box separate and unchecked, and reports optional consent errors after signing", () => {
    const ui = read("../../components/presentations/presentation-onboarding.tsx");
    const route = read("../../app/api/sign-agreement/route.ts");
    expect(ui).toContain("optedIn: false");
    expect(ui).toContain("This is optional and not required to join");
    expect(ui).toContain("This does not authorize marketing texts");
    expect(ui).toContain("Reply STOP to opt out or HELP for help");
    expect(ui).toContain("smsConsent.key === smsConsentKey && smsConsent.optedIn");
    expect(ui).toContain('role="status"');
    expect(route.indexOf("smsReminderPhone = enrollmentReminderPhone")).toBeLessThan(route.indexOf("const result = await completeSignOnboarding"));
    expect(route.indexOf("const result = await completeSignOnboarding")).toBeLessThan(route.indexOf("await recordSignTogetherReminderConsent"));
  });
  it("requires original signed evidence, preserves opt-outs and guards number ownership", () => {
    const sql = read("../persistence/supabase/migrations/20261114182000_sign_together_visit_sms.sql");
    expect(sql).toContain("agreement.visit_sms_opt_in = true");
    expect(sql).toContain("agreement.visit_sms_phone = p_address_normalized");
    expect(sql).toContain("agreement.status = 'complete'");
    expect(sql).toContain("v_prior_status = 'opted_out'");
    expect(sql).toContain("The conversation does not belong to this customer");
    expect(sql).toContain("This number belongs to another customer");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("'signed-agreement:' || p_agreement_id::text");
    const completion = read("../membership/complete-sign-onboarding.ts");
    expect(completion).toContain("visit_sms_phone: input.smsReminderPhone ?? null");
    expect(completion).not.toMatch(/\.update\(\{[^}]*visit_sms_/);
  });
});
