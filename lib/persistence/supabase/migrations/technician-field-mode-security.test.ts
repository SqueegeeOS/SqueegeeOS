import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(__dirname, "20260929170000_prevent_split_technician_visit_writes.sql"),
  "utf8",
);

describe("single field workflow per Jobber visit", () => {
  it("serializes the native and legacy ledgers on the same external visit", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("'homeatlas:field-visit:squeegeeking:' || visit_external_id");
    expect(migration).toContain("on public.homeatlas_technician_visit_assignments");
    expect(migration).toContain("on public.technician_job_time_entries");
    expect(migration).toContain("on public.technician_visit_events");
    expect(migration).toContain("on public.property_assessments");
  });

  it("checks real legacy work before a native assignment and blocks later legacy writes", () => {
    expect(migration).toContain("from public.technician_job_time_entries clock_entry");
    expect(migration).toContain("from public.technician_visit_events route_event");
    expect(migration).toContain("assessment.field_record_id is not null");
    expect(migration).toContain("assignment.external_visit_id = visit_external_id");
  });

  it("does not expose the internal guard as a callable Data API function", () => {
    expect(migration).toContain("security invoker");
    expect(migration).toContain(
      "from public, anon, authenticated, service_role",
    );
  });
});
