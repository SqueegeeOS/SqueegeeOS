import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultPresentation } from "@/lib/presentations/repository";
import { buildEnrollmentDocumentSnapshot } from "./document-snapshot";
import type { EnrollmentPacketRow } from "./types";
import { completeRemoteEnrollmentSignature } from "./complete-remote-signature";

const mocks = vi.hoisted(() => ({
  from: vi.fn(), getPresentation: vi.fn(), persistPlan: vi.fn(),
}));
vi.mock("@/lib/persistence/supabase/client", () => ({ createServiceRoleSupabaseClient: () => ({ from: mocks.from }) }));
vi.mock("@/lib/presentations/repository", async (original) => ({ ...await original<object>(), getPresentation: mocks.getPresentation }));
vi.mock("@/lib/membership/portal-home-care-plan", async (original) => ({ ...await original<object>(), persistPortalHomeCarePlan: mocks.persistPlan }));
vi.mock("@/lib/agreement/store-signed-pdf", () => ({ storeSignedPdf: async () => ({ backend: "supabase", url: "private/agreement.pdf" }) }));
vi.mock("@/lib/agreement/generate-signed-pdf", () => ({ generateSignedPDF: async () => new Uint8Array([1]) }));
vi.mock("@/lib/agreement/store-signature-image", () => ({ storeSignatureImage: async () => ({ storageRef: "private/signature.png", storagePath: "signature.png" }) }));
vi.mock("@/lib/sales/lead-contact-handoff", () => ({ preserveSalesLeadSmsHandoff: async () => {} }));
vi.mock("@/lib/sales/signed-attribution-server", () => ({ recordSignedMembershipAttribution: async () => ({ status: "not_rep_attributed" }) }));
vi.mock("@/lib/referrals/repository", () => ({ markReferralConverted: async () => {} }));

function fixture() {
  const presentation = createDefaultPresentation({ clientName: "Test Homeowner", clientAddress: "123 Test Street, Chico, CA 95928", clientEmail: "test@example.com", tier: "biannual" });
  presentation.planMode = "custom";
  presentation.carePlan.visits = presentation.carePlan.visits.map((visit) => ({ ...visit, gutterCleaning: "included", solarPanels: "included", priceOverride: 714 }));
  const snapshot = buildEnrollmentDocumentSnapshot({ presentation, tier: "biannual", firstVisitPrice: 714, recurringVisitPrice: 714, annualizedValue: 1428, salesContext: "remote", homeSolicitationNoticeDays: null, paymentRail: "stripe_card", createdAt: "2026-11-10T00:00:00Z" });
  // Model a mutable presentation that no longer agrees with the signed packet.
  presentation.monthlyRate = 300;
  presentation.overrideTier = "biannual";
  presentation.visitRateOverrides = { biannual: 300 };
  presentation.carePlan.visits = presentation.carePlan.visits.map((visit) => ({ ...visit, gutterCleaning: "not_included", priceOverride: 300 }));
  const packet = {
    id: "packet", presentation_id: presentation.id, customer_email: snapshot.customer.email,
    agreement_tier: "biannual", first_visit_price_cents: 71400,
    recurring_visit_price_cents: 71400, annualized_value_cents: 142800,
    payment_rail: "stripe_card", document_snapshot: snapshot,
    msa_version_id: "msa", service_agreement_version_id: "service",
    docusign_envelope_id: "envelope", manual_payment_approved_at: null, manual_payment_approved_by: null,
  } as EnrollmentPacketRow & { msa_version_id: string; service_agreement_version_id: string };
  return { presentation, packet };
}

const writes: Array<{ table: string; operation: string; payload: Record<string, unknown> }> = [];
beforeEach(() => {
  vi.clearAllMocks();
  writes.length = 0;
  mocks.from.mockImplementation((table: string) => {
    let operation = "select";
    let payload: Record<string, unknown> = {};
    const result = () => {
      if (table === "presentations" && operation === "update") {
        // A PostgREST-style schema boundary: application property names are not columns.
        const columns = new Set(["status", "signed_at", "agreement_id", "homeowner_id", "property_id", "membership_id", "onboarding_status", "tier", "annual_rate", "visit_rate_overrides", "draft_payload", "monthly_rate", "override_tier"]);
        const invalid = Object.keys(payload).find((key) => !columns.has(key));
        if (invalid) return { data: null, error: { message: `Could not find the '${invalid}' column of 'presentations' in the schema cache` } };
      }
      const data = operation === "select"
        ? table === "agreement_document_versions"
          ? [{ id: "msa", document_kind: "master_service_agreement", version: "v1", status: "approved" }, { id: "service", document_kind: "service_quote_agreement", version: "v1", status: "approved" }]
          : null
        : { id: `${table}-id` };
      return { data, error: null };
    };
    const chain = {
      select: vi.fn(() => chain), eq: vi.fn(() => chain), in: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => result()), single: vi.fn(async () => result()),
      then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
      insert: vi.fn((value) => write("insert", value)), upsert: vi.fn((value) => write("upsert", value)), update: vi.fn((value) => write("update", value)),
    };
    function write(kind: string, value: Record<string, unknown>) {
      operation = kind; payload = value; writes.push({ table, operation, payload }); return chain;
    }
    return chain;
  });
});

describe("remote signature presentation persistence", () => {
  it.each(["homeatlas_native", "docusign"] as const)("completes %s with valid SQL columns and frozen $714 gutter scope", async (signatureProvider) => {
    const { presentation, packet } = fixture();
    const frozen = JSON.stringify(packet.document_snapshot);
    mocks.getPresentation.mockResolvedValue(presentation);
    const result = await completeRemoteEnrollmentSignature({ packet, signedAt: "2026-11-10T01:00:00Z", signatureProvider, signatureDataUrl: "data:image/png;base64,AQ==", combinedPdf: new Uint8Array([1]) });
    expect(result.alreadyCompleted).toBe(false);
    const row = writes.find((write) => write.table === "presentations")!.payload;
    expect(row).toMatchObject({ monthly_rate: 714, override_tier: "biannual", annual_rate: 1428, visit_rate_overrides: { biannual: 714 }, agreement_id: "signed_agreements-id", status: "signed" });
    expect(row).not.toHaveProperty("monthlyRate");
    expect(row).not.toHaveProperty("overrideTier");
    expect(row.draft_payload).toMatchObject({ monthlyRate: 714, visitRateOverrides: { biannual: 714 }, carePlan: { visits: [expect.objectContaining({ gutterCleaning: "included", priceOverride: 714 }), expect.objectContaining({ gutterCleaning: "included", priceOverride: 714 })] } });
    expect(writes.find((write) => write.table === "memberships" && write.operation === "insert")?.payload).toMatchObject({ visit_price: 714, annual_rate: 1428, visits_per_year: 2 });
    expect(JSON.stringify(packet.document_snapshot)).toBe(frozen);
  });

  it("rejects a mismatched frozen snapshot before any persistence", async () => {
    const { presentation, packet } = fixture();
    mocks.getPresentation.mockResolvedValue(presentation);
    packet.recurring_visit_price_cents = 30000;
    await expect(completeRemoteEnrollmentSignature({ packet, signedAt: "2026-11-10T01:00:00Z", signatureProvider: "homeatlas_native", signatureDataUrl: "data:image/png;base64,AQ==" })).rejects.toThrow("snapshot does not match");
    expect(writes).toEqual([]);
  });
});
