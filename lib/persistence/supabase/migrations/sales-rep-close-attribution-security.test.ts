import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const migration = read("./050_sales_rep_close_attribution.sql").replace(
  /\s+/g,
  " ",
);
const attributionServer = read("../../../sales/signed-attribution-server.ts");
const workspaceServer = read("../../../sales/workspace-server.ts");
const signRoute = read("../../../../app/api/sign-agreement/route.ts");
const presentationRoute = read("../../../../app/api/presentations/route.ts");
const audit = read("../../../../scripts/audit-migrations.mjs").replace(
  /\s+/g,
  " ",
);

describe("signature-backed sales attribution security", () => {
  it("applies schema and privacy changes atomically", () => {
    expect(migration).toContain("begin;");
    expect(migration.trim().endsWith("commit;")).toBe(true);
  });

  it("stores stable presentation-to-rep and optional owned-lead lineage", () => {
    expect(migration).toContain("add column if not exists sales_rep_id uuid");
    expect(migration).toContain("add column if not exists sales_rep_lead_id uuid");
    expect(migration).toContain("presentations_sales_rep_lead_owner_fkey");
    expect(migration).toContain(
      "foreign key (sales_rep_lead_id, sales_rep_id) references public.sales_rep_leads(id, rep_id)",
    );
    expect(migration).toContain(
      "sales_rep_attributions_presentation_owner_fkey",
    );
    expect(migration).toContain(
      "foreign key (presentation_id, rep_id) references public.presentations(id, sales_rep_id)",
    );
    expect(presentationRoute).toContain("resolvePresentationSalesLineage");
    expect(presentationRoute).toContain("clientPhone: lineage?.lead?.phone");
    expect(presentationRoute).toContain("markSalesLeadPresentationCreated");
    expect(presentationRoute).not.toContain("createdBy: body.createdBy");
  });

  it("backfills David from the database and snapshots the database membership ARR", () => {
    expect(migration).toContain(
      "lower(btrim(coalesce(p.created_by, ''))) = 'david'",
    );
    expect(migration).toContain("and r.slug = 'david'");
    expect(migration).toContain(
      "round(coalesce(m.annual_rate, 0) * 100)",
    );
    expect(migration).toContain("when m.status = 'active' then 'active'");
    expect(migration).toContain(
      "when m.status in ('cancelled', 'archived') then 'cancelled'",
    );
    expect(migration).toContain("r.compensation_plan");
    expect(migration).toContain(
      "set attribution_source = 'legacy_backfill' where attribution_source is null",
    );
    expect(migration).toContain(
      "or (p.membership_id is null and m.presentation_id = p.id)",
    );
    expect(migration).toContain("sa.status = 'complete'");
    expect(migration).toContain("sa.membership_id = m.id");
    expect(migration).toContain("sa.presentation_id = p.id");
    expect(migration).toContain("other_m.id <> m.id");
    expect(migration).toContain(
      "a.rep_id <> p.sales_rep_id",
    );
    expect(migration).toContain(
      "where public.sales_rep_attributions.rep_id = excluded.rep_id",
    );
  });

  it("keeps browser roles from mutating attribution lineage", () => {
    expect(migration).toContain(
      "revoke all privileges on table public.sales_rep_attributions from public, anon, authenticated",
    );
    expect(migration).toContain(
      "revoke all privileges on table public.presentations from public, anon, authenticated",
    );
    expect(migration).toContain("tablename = 'presentations'");
    expect(migration).toContain(
      "drop policy if exists %I on public.presentations",
    );
    expect(migration).toContain("('presentations')");
    expect(migration).toContain("homeatlas_security_posture");
    expect(migration).toContain(
      "revoke insert, update, delete on table public.sales_rep_activity_events from public, anon, authenticated",
    );
    expect(migration).toContain(
      "grant select, insert on table public.sales_rep_attributions to service_role",
    );
    expect(migration).toContain(
      "revoke update on table public.sales_rep_attributions from service_role",
    );
    expect(migration).toContain(
      "grant update ( lead_id, qualification_status, membership_started_at, retention_qualifies_at, qualified_at, updated_at ) on table public.sales_rep_attributions to service_role",
    );
    expect(migration).toContain(
      "grant select, insert, update, delete on table public.presentations to service_role",
    );
    expect(migration).not.toMatch(
      /grant\s+[^;]*(?:sales_rep_id|sales_rep_lead_id|client_event_id)[^;]*to\s+(?:anon|authenticated)/i,
    );
    expect(migration).toContain("('customer_contact_consent_events')");
    expect(migration).toContain(
      "('customer_communication_provider_verifications')",
    );
  });

  it("records one signature attribution and treats duplicate inserts as retries", () => {
    expect(attributionServer).toContain('.from("memberships")');
    expect(attributionServer).toContain("annualRateToCents(membership.annual_rate)");
    expect(attributionServer).toContain('qualification_status: qualificationStatus');
    expect(attributionServer).toContain('attribution_source: "agreement_signature"');
    expect(attributionServer).toContain('insertResult.error.code !== "23505"');
    expect(attributionServer).not.toContain(".upsert(");
    expect(attributionServer).toContain('status: "signed"');
    expect(attributionServer).toContain(
      "attribution.presentation_id !== presentation.id",
    );
    expect(attributionServer).toContain(
      "Number(attribution.attributed_arr_cents) !== attributedArrCents",
    );
    expect(attributionServer).toContain(
      'agreement.status !== "complete"',
    );
  });

  it("does not make a legal signing fail when sales tracking is unavailable", () => {
    expect(signRoute).toContain("await recordSignedMembershipAttribution");
    expect(signRoute).toContain("nonfatal sales attribution failure");
    expect(signRoute).toMatch(
      /try \{[\s\S]*recordSignedMembershipAttribution[\s\S]*\} catch \(trackingError\)/,
    );
  });

  it("reports real closes from attributions rather than manual signed taps", () => {
    expect(workspaceServer).toContain("SALES_ATTRIBUTION_SELECT");
    expect(workspaceServer).toContain(
      '.select(SALES_ATTRIBUTION_SELECT, { count: "exact" })',
    );
    expect(workspaceServer).toContain("loadAllSalesRepAttributionRows(rep.id)");
    expect(workspaceServer).toContain("signedToday: attributionsToday.length");
    expect(workspaceServer).toContain("closedArrTodayCents");
    expect(workspaceServer).toContain("closedArrCents");
    expect(workspaceServer).not.toContain(
      'signedToday: activityCount("membership_signed")',
    );
  });

  it("repairs bounded missing signature attributions without blocking metrics", () => {
    expect(attributionServer).toContain(
      "reconcileSignedMembershipAttributionsForRep",
    );
    expect(attributionServer).toContain("Math.min(10");
    expect(attributionServer).toContain("const scanLimit = Math.min(100");
    expect(attributionServer).toContain('.from("signed_agreements")');
    expect(attributionServer).toContain('.in("presentation_id", presentationIds)');
    expect(workspaceServer).toContain(
      "await reconcileSignedMembershipAttributionsForRep(rep.id, 5)",
    );
    expect(workspaceServer).toContain(
      "nonfatal attribution reconciliation failure",
    );
  });

  it("deduplicates offline pulse retries and audits migration 050", () => {
    expect(migration).toContain("add column if not exists client_event_id uuid");
    expect(migration).toContain(
      "sales_rep_activity_rep_client_event_uidx",
    );
    expect(workspaceServer).toContain('onConflict: "rep_id,client_event_id"');
    expect(audit).toMatch(/\["050", "signature-backed sales attribution"/);
  });
});
