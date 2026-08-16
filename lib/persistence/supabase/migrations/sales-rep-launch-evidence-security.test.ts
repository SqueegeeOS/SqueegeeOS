import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("./076_sales_rep_launch_evidence.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");

describe("sales rep launch evidence migration", () => {
  it("exposes one stable read-only aggregate to service_role only", () => {
    expect(migration).toContain(
      "create or replace function public.homeatlas_sales_rep_launch_evidence()",
    );
    expect(migration).toContain("language sql stable security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain(
      "revoke all on function public.homeatlas_sales_rep_launch_evidence() from public, anon, authenticated",
    );
    expect(migration).toContain(
      "grant execute on function public.homeatlas_sales_rep_launch_evidence() to service_role",
    );
    expect(migration).not.toMatch(/\b(?:insert|update|delete|upsert)\b/i);
  });

  it("counts durable Door Memory and signature-backed attribution evidence", () => {
    expect(migration).toContain("public.sales_rep_door_visits");
    expect(migration).toContain("public.sales_rep_leads");
    expect(migration).toContain("public.presentations");
    expect(migration).toContain("presentation.sales_rep_lead_id is not null");
    expect(migration).toContain("public.sales_rep_attributions");
    expect(migration).toContain("attribution.signed_agreement_id is not null");
    expect(migration).toContain(
      "attribution.qualification_status <> 'cancelled'",
    );
  });
});
