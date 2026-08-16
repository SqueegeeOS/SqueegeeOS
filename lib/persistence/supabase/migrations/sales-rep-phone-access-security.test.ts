import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const migration = read("./067_sales_rep_phone_access.sql");
const audit = read("../../../../scripts/audit-migrations.mjs");
const securityVerification = read(
  "../../../../scripts/verify-supabase-security.mjs",
);
const productionHealth = read("../../../admin/production-health-server.ts");

describe("migration 067 sales phone identity and privacy", () => {
  it("applies atomically and preserves one current pass per representative", () => {
    expect(migration.trimStart().toLowerCase()).toContain("begin;");
    expect(migration.trim().toLowerCase().endsWith("commit;")).toBe(true);
    expect(migration).toContain("sales_rep_access_grants_current_rep_uidx");
    expect(migration).toContain("where status in ('pending', 'active')");
    expect(migration).toContain(
      "rep_id uuid not null references public.sales_reps(id) on delete restrict",
    );
  });

  it("fails inactive reps closed at issue, claim, and every session read", () => {
    expect(migration).toContain("and rep.status = 'active'");
    expect(migration).toContain("Sales representative is not active");
    expect(migration).toContain("p_invite_expires_at > now() + interval '25 hours'");
    expect(migration).toContain("p_session_expires_at > now() + interval '31 days'");
  });

  it("extends migration, security, and production-health verification", () => {
    expect(migration).toContain("('sales_rep_access_grants')");
    expect(migration).toContain(
      "create or replace function public.homeatlas_security_posture()",
    );
    expect(audit).toContain(
      '["067", "sales representative phone access"',
    );
    expect(audit).toContain("sales_rep_access_grants_current_rep_uidx");
    expect(securityVerification).toContain('"sales_rep_access_grants"');
    expect(securityVerification).toContain("through 067");
    expect(productionHealth).toContain('label: "sales_rep_access_grants"');
  });
});
