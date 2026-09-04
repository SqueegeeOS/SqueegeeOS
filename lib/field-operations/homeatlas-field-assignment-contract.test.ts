import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../persistence/supabase/migrations/20260904120000_homeatlas_field_assignments.sql",
    import.meta.url,
  ),
  "utf8",
);
const dispatchRoute = readFileSync(
  new URL("../../app/api/admin/dispatch/assignment/route.ts", import.meta.url),
  "utf8",
);
const fieldClockRoute = readFileSync(
  new URL("../../app/api/field/job-clock/route.ts", import.meta.url),
  "utf8",
);
const fieldRecordRoute = readFileSync(
  new URL("../../app/api/field/field-records/route.ts", import.meta.url),
  "utf8",
);

describe("HomeAtlas-native field assignment contract", () => {
  it("keeps Jobber as schedule authority and scopes assignment to an exact projection", () => {
    expect(migration).toContain("references public.jobber_visit_projections(id)");
    expect(migration).toContain("connection_id = 'squeegeeking'");
    expect(migration).toContain("Only an active future Jobber visit can be assigned here");
    expect(migration).toContain("unique (connection_id, external_visit_id)");
  });

  it("keeps staffing and execution private, replay-safe, and auditable", () => {
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("client_request_id uuid not null unique");
    expect(migration).toContain("append-only and immutable");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("cannot be reassigned");
  });

  it("requires the exact active Field Pass and a closeout before clock-out", () => {
    expect(migration).toContain("grant_row.status = 'active'");
    expect(migration).toContain("grant_row.session_expires_at > now()");
    expect(migration).toContain("'homeatlas:' || assignment_row.technician_id::text");
    expect(migration).toContain("Save the HomeAtlas closeout before clocking out");
    expect(migration).toContain("Start the job clock at the property before documenting this visit");
  });

  it("routes native staffing, clocking, and closeout through dedicated server paths", () => {
    expect(dispatchRoute).toContain('startsWith("homeatlas:")');
    expect(fieldClockRoute).toContain("assertTechnicianAssignedToFieldAssignment");
    expect(fieldRecordRoute).toContain("commitFieldAssignmentCloseout");
  });
});
