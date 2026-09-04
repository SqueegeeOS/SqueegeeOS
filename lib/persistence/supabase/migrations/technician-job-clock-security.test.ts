import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("./20260901052357_technician_job_clock.sql", import.meta.url),
  "utf8",
)
  .replace(/\r\n/g, "\n")
  .toLowerCase();

describe("technician job clock migration", () => {
  it("keeps time records private and routes writes through one service RPC", () => {
    expect(migration.trimStart()).toContain("begin;");
    expect(migration.trim().endsWith("commit;")).toBe(true);
    expect(migration).toContain(
      "alter table public.technician_job_time_entries enable row level security",
    );
    expect(migration).toContain(
      "revoke all privileges on table public.technician_job_time_entries\n  from public, anon, authenticated, service_role",
    );
    expect(migration).toContain(
      "grant select on table public.technician_job_time_entries to service_role",
    );
    expect(migration).not.toMatch(
      /grant\s+(insert|update|delete)\s+on table public\.technician_job_time_entries/,
    );
    expect(migration).toContain(
      "grant execute on function public.record_technician_job_clock_action",
    );
  });

  it("binds one idempotent timer to a verified Jobber appointment", () => {
    expect(migration).toContain(
      "create unique index if not exists technician_job_time_entries_appointment_uidx",
    );
    expect(migration).toContain(
      "appointment_provider is distinct from 'jobber'",
    );
    expect(migration).toContain("perform pg_advisory_xact_lock");
    expect(migration).toContain(
      "raise exception 'start the job clock before finishing it'",
    );
    expect(migration).toContain("ended_at >= started_at");
  });
});
