import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "lib/persistence/supabase/migrations/20260929005648_technician_job_addon_reports.sql"), "utf8");
const route = readFileSync(resolve(process.cwd(), "app/api/field/job-addons/route.ts"), "utf8");
const server = readFileSync(resolve(process.cwd(), "lib/field-operations/technician-job-addon-server.ts"), "utf8");
const correctionRoute = readFileSync(resolve(process.cwd(), "app/api/admin/technicians/[technicianId]/job-addons/[reportId]/void/route.ts"), "utf8");

describe("technician job add-on access boundary", () => {
  it("keeps the log private and prevents reassignment or silent report rewriting", () => {
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("technician_job_addon_report_assignment_guard");
    expect(migration).toContain("technician_job_addon_report_correction_guard");
    expect(migration).toContain("jobber_user_id = 'homeatlas:' || new.technician_id::text");
  });

  it("requires a technician Field Pass and the current assigned job before reads or writes", () => {
    expect(route).toContain('actor.kind !== "technician"');
    expect(server).toContain("assertTechnicianAssignedToFieldAssignment(actor, assignmentId)");
    expect(server).toContain("assertTechnicianAssignedToFieldAssignment(actor, input.assignmentId)");
    expect(server).toContain('homeAtlasTechnicianId(actor.jobberUserId)');
  });

  it("limits corrections to HQ and a reason on the exact technician report", () => {
    expect(correctionRoute).toContain("authorizeAdminRequest(request.headers)");
    expect(correctionRoute).toContain('.eq("technician_id", technicianId)');
    expect(correctionRoute).toContain('.is("voided_at", null)');
    expect(correctionRoute).toContain("reason.length < 3");
  });
});
