import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const migration = read(
  "lib/persistence/supabase/migrations/20260909060000_live_same_day_dispatch.sql",
);
const fieldScope = read("lib/field-operations/field-scope.ts");
const liveServer = read("lib/field-operations/live-dispatch-server.ts");
const profileServer = read("lib/field-operations/technician-profile-server.ts");
const closeoutServer = read("lib/field-records/visit-field-record-server.ts");
const adminRoute = read(
  "app/api/admin/technicians/[technicianId]/live-jobs/route.ts",
);

describe("HomeAtlas live same-day dispatch contract", () => {
  it("lets an assignment exist before Jobber while preserving one durable assignment row", () => {
    expect(migration).toContain("alter column projection_id drop not null");
    expect(migration).toContain("source_kind text not null default 'jobber'");
    expect(migration).toContain("sync_state text not null default 'verified'");
    expect(migration).toContain("'pending_sync'");
    expect(migration).toContain("create_live_homeatlas_technician_job");
    expect(migration).toContain("reconcile_live_homeatlas_technician_job");
    expect(migration).toContain("update public.homeatlas_technician_visit_assignments");
  });

  it("uses the same native clock and closeout before and after reconciliation", () => {
    expect(migration).toContain("assignment_row.live_scheduled_start");
    expect(migration).toContain("record_homeatlas_technician_job_clock_action");
    expect(migration).toContain("commit_homeatlas_technician_job_closeout");
    expect(migration).toContain("update public.homeatlas_technician_job_clocks");
    expect(migration).toContain("update public.homeatlas_technician_job_closeouts");
    expect(closeoutServer).toContain("live_service_scope");
  });

  it("keeps uncertain Jobber matching pending rather than guessing", () => {
    expect(liveServer).toContain("chooseLiveDispatchReconciliationCandidate");
    expect(liveServer).toContain("if (!candidate) continue");
    expect(liveServer).toContain("alreadyLinked");
  });

  it("merges pending live jobs into Field Run before Jobber catches up", () => {
    expect(fieldScope).toContain("reconcilePendingLiveDispatchJobs");
    expect(fieldScope).toContain("loadPendingLiveFieldVisits");
    expect(fieldScope).toContain("summarizeJobberTodayVisits(visits)");
    expect(liveServer).toContain('jobStatus: "PENDING_JOBBER_SYNC"');
    expect(liveServer).toContain("homeAtlasFieldAssignmentId: row.id");
  });

  it("makes Tyler's profile include native clock hours and freshness truth", () => {
    expect(profileServer).toContain('from("homeatlas_technician_job_clocks")');
    expect(profileServer).toContain("todayClockedMinutes");
    expect(profileServer).toContain("pendingSyncJobs");
    expect(profileServer).toContain("jobberLastSyncedAt");
  });

  it("keeps live job creation behind founder/admin authorization", () => {
    expect(adminRoute).toContain("authorizeAdminRequest");
    expect(adminRoute).toContain('"Cache-Control": "private, no-store"');
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
  });
});
