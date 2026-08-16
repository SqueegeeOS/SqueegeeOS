import { describe, expect, it } from "vitest";
import {
  SALES_LEAD_CAPTURE_DRAFT_TTL_MS,
  hasMeaningfulSalesLeadCaptureDraft,
  parseSalesLeadCaptureDraft,
  salesLeadCaptureDraftStorageKey,
  serializeSalesLeadCaptureDraft,
} from "./lead-capture-draft";
import type { CreateSalesLeadInput } from "./workspace-types";

const form: CreateSalesLeadInput = {
  clientEventId: "00000000-0000-4000-8000-000000000101",
  fullName: "Jordan Homeowner",
  propertyAddress: "123 Atlas Way",
  phone: "(530) 555-0101",
  email: "jordan@example.com",
  serviceInterests: ["exterior_windows", "screens"],
  estimatedArrDollars: 1800,
  nextFollowUpAt: "2026-08-20T17:00",
  notes: "Call after work.",
  smsConsentAttested: true,
  emailConsentAttested: true,
  doorMemoryClientEventId: "00000000-0000-4000-8000-000000000102",
};

describe("sales lead capture draft", () => {
  it("restores one rep's recent private draft but requires fresh permission", () => {
    const now = new Date("2026-08-16T18:00:00.000Z");
    const raw = serializeSalesLeadCaptureDraft("David", form, now);
    const restored = parseSalesLeadCaptureDraft(raw, "david", now);

    expect(restored).toMatchObject({
      clientEventId: form.clientEventId,
      fullName: form.fullName,
      propertyAddress: form.propertyAddress,
      serviceInterests: form.serviceInterests,
      doorMemoryClientEventId: form.doorMemoryClientEventId,
      smsConsentAttested: false,
      emailConsentAttested: false,
    });
    expect(raw).not.toContain("smsConsentAttested");
    expect(raw).not.toContain("emailConsentAttested");
  });

  it("rejects stale, cross-rep, malformed, and identity-conflicting drafts", () => {
    const savedAt = new Date("2026-08-15T12:00:00.000Z");
    const raw = serializeSalesLeadCaptureDraft("david", form, savedAt);
    const staleNow = new Date(
      savedAt.getTime() + SALES_LEAD_CAPTURE_DRAFT_TTL_MS + 1,
    );

    expect(parseSalesLeadCaptureDraft(raw, "david", staleNow)).toBeNull();
    expect(parseSalesLeadCaptureDraft(raw, "alex", savedAt)).toBeNull();
    expect(parseSalesLeadCaptureDraft("not-json", "david", savedAt)).toBeNull();
    expect(
      parseSalesLeadCaptureDraft(
        serializeSalesLeadCaptureDraft(
          "david",
          { ...form, doorMemoryClientEventId: form.clientEventId },
          savedAt,
        ),
        "david",
        savedAt,
      ),
    ).toBeNull();
  });

  it("uses a rep-scoped key and detects only meaningful capture work", () => {
    expect(salesLeadCaptureDraftStorageKey(" David ")).toBe(
      "homeatlas.sales-lead-draft.v1.david",
    );
    expect(hasMeaningfulSalesLeadCaptureDraft(form)).toBe(true);
    expect(
      hasMeaningfulSalesLeadCaptureDraft({
        ...form,
        fullName: "",
        propertyAddress: "",
        phone: "",
        email: "",
        serviceInterests: ["exterior_windows"],
        nextFollowUpAt: "",
        notes: "",
        doorMemoryClientEventId: null,
      }),
    ).toBe(false);
  });
});
