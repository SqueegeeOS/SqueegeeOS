import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("./20260904000542_persistent_technician_access.sql", import.meta.url),
  "utf8",
).replace(/\r\n/g, "\n");

describe("persistent technician access migration", () => {
  it("keeps the HomeAtlas technician roster private", () => {
    expect(migration).toContain("create table if not exists public.homeatlas_technicians");
    expect(migration).toContain("alter table public.homeatlas_technicians enable row level security");
    expect(migration).toContain("revoke all privileges on table public.homeatlas_technicians");
    expect(migration).toContain("to service_role");
  });

  it("supports technician referrals without treating verbal contact permission as SMS consent", () => {
    expect(migration).toContain("'technician_referral'");
    expect(migration).toContain("referred_by_technician_key");
    expect(migration).toContain("referral_permission_confirmed_at");
    expect(migration).toContain("this is not SMS marketing consent");
  });

  it("keeps technician access revocable while removing monthly re-enrollment", () => {
    expect(migration).toContain("interval '401 days'");
    expect(migration).toContain("access_role = 'technician'");
    expect(migration).toContain("grant_row.status = 'pending'");
  });
});
