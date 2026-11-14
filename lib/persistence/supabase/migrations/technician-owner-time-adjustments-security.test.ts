import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync(new URL("./20261113210000_technician_owner_time_adjustments.sql", import.meta.url), "utf8").toLowerCase();
describe("audited owner technician time", () => {
  it("keeps both audit ledgers private and immutable", () => {
    for (const table of ["homeatlas_technician_owner_time_adjustments", "homeatlas_technician_owner_time_adjustment_voids"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`revoke all privileges on table public.${table} from public, anon, authenticated, service_role`);
      expect(sql).toContain(`grant select on table public.${table} to service_role`);
    }
    expect(sql).not.toMatch(/grant\s+(insert|update|delete)\s+on/);
    expect(sql).toContain("before update or delete");
  });
  it("restricts privileged mutation routines to service role", () => {
    for (const signature of ["record_homeatlas_owner_time_adjustment(uuid,date,integer,uuid,text,text,text,text)", "void_homeatlas_owner_time_adjustment(uuid,text,text)"]) {
      expect(sql).toContain(`revoke all on function public.${signature} from public, anon, authenticated`);
      expect(sql).toContain(`grant execute on function public.${signature} to service_role`);
    }
    expect(sql).toContain("set search_path = public, pg_temp");
  });
  it("preserves native evidence and validates identity, dates, and active resolutions", () => {
    expect(sql).not.toMatch(/update public\.homeatlas_technician_job_clocks set/);
    expect(sql).toContain("clock belongs to a different technician");
    expect(sql).toContain("clock_row.ended_at is not null");
    expect(sql).toContain("clock_row.started_at at time zone 'america/los_angeles'");
    expect(sql).toContain("this clock already has an active owner resolution");
    expect(sql).toContain("void the owner resolution before recording a technician clock-out");
    expect(sql).toContain("p_duration_minutes not between 1 and 1080");
  });
  it("serializes duplicate submissions and supports explicit reversal", () => {
    expect(sql).toContain("idempotency_key text not null unique");
    expect(sql).toContain("perform pg_advisory_xact_lock");
    expect(sql).toContain("already belongs to different adjustment details");
    expect(sql).toContain("existing.duration_minutes is distinct from p_duration_minutes");
    expect(sql).toContain("adjustment_id uuid not null unique");
    expect(sql).toContain("this adjustment was voided");
  });
});
