import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const migration = read(
  "../persistence/supabase/migrations/058_technician_visit_automation.sql",
);
const fieldEventRoute = read(
  "../../app/api/field/visit-events/route.ts",
);
const fieldRecordRoute = read(
  "../../app/api/field/field-records/route.ts",
);
const adminFieldRecordRoute = read(
  "../../app/api/admin/field-records/route.ts",
);
const eventServer = read("./technician-visit-event-server.ts");
const eventModel = read("./technician-visit-events.ts");
const todayLoader = read("../care-operations/jobber-today.ts");
const todayTypes = read("../care-operations/jobber-today-types.ts");
const fieldRun = read(
  "../../components/field/technician-today-workspace.tsx",
);
const jobClockRoute = read("../../app/api/field/job-clock/route.ts");
const hqToday = read("../../components/admin/today-workspace-page.tsx");

describe("technician visit automation contract", () => {
  it("keeps every appointment timeline private and service-role only", () => {
    expect(migration).toContain(
      "alter table public.technician_visit_events enable row level security",
    );
    expect(migration).toContain(
      "revoke all privileges on table public.technician_visit_events",
    );
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
    expect(migration).toContain("('technician_visit_events')");
  });

  it("makes stage changes monotonic, replay-safe, and closeout-backed", () => {
    expect(migration).toContain(
      "technician_visit_events_stage_uidx",
    );
    expect(migration).toContain(
      "pg_advisory_xact_lock(hashtextextended(p_appointment_id::text, 0))",
    );
    expect(migration).toContain("Technician route cannot move backwards");
    expect(migration).toContain("Complete the prior technician route stage first");
    expect(migration).toContain(
      "Save the HomeAtlas closeout before completing service",
    );
    expect(migration).toContain("assessment.field_record_id = p_event_id");
    expect(migration).toContain("true;");
  });

  it("rechecks the exact Field Pass and Jobber appointment before every action", () => {
    expect(fieldEventRoute).toContain(
      "authorizeFieldRequest(request.headers)",
    );
    expect(fieldEventRoute).toContain("assertFieldActorCanWriteAppointment");
    expect(migration).toContain("grant_row.status = 'active'");
    expect(migration).toContain("grant_row.session_expires_at > now()");
    expect(migration).toContain(
      "appointment_provider is distinct from 'jobber'",
    );
  });

  it("prepares alerts without importing or calling a delivery provider", () => {
    expect(migration).toContain(
      "customer_alert_state in ('not_applicable', 'draft_only')",
    );
    expect(migration).not.toContain("customer_alert_state = 'sent'");
    for (const source of [fieldEventRoute, fieldRecordRoute, eventServer]) {
      expect(source.toLowerCase()).not.toContain("twilio");
      expect(source.toLowerCase()).not.toContain("resend");
      expect(source.toLowerCase()).not.toContain("sendmessage");
    }
  });

  it("never rolls back a saved closeout when route advancement needs retry", () => {
    expect(fieldRecordRoute).toContain("await commitFieldAssignmentCloseout");
    expect(fieldRecordRoute).toContain("await commitVisitFieldRecord(input)");
    for (const source of [fieldRecordRoute, adminFieldRecordRoute]) {
      expect(source).toContain("routeEventRecorded = false");
      expect(source).toContain(
        "Closeout saved, but route status needs a retry",
      );
      expect(source).toContain('eventType: "service_completed"');
      expect(source).toContain("return NextResponse.json(");
    }
    expect(fieldRecordRoute.indexOf("await commitVisitFieldRecord(input)")).toBeLessThan(
      fieldRecordRoute.indexOf("await recordTechnicianVisitEvent({"),
    );
  });

  it("shows safe lifecycle state in Today without exposing alert drafts", () => {
    expect(todayLoader).toContain("loadTechnicianVisitEventSnapshots");
    expect(todayLoader).toContain("fieldEventStatusAvailable");
    expect(todayTypes).toContain("homeAtlasFieldStage");
    expect(todayTypes).not.toContain("customerAlertDraft");
    expect(fieldRun).toContain("Automated service flow");
    expect(eventModel).toContain('label: "On my way"');
    expect(fieldRun).toContain("Nothing is");
    expect(fieldRun).toContain("sent until messaging approval");
    expect(hqToday).toContain("Live field status");
    expect(hqToday).toContain("fieldEventStatusAvailable");
  });

  it("keeps the technician interaction to arrival, proof, and final clock-out", () => {
    expect(jobClockRoute).toContain("START_LIFECYCLE");
    expect(jobClockRoute).toContain('"en_route"');
    expect(jobClockRoute).toContain('"arrived"');
    expect(jobClockRoute).toContain('"service_started"');
    expect(jobClockRoute).toContain('"service_completed"');
    expect(jobClockRoute).toContain('"departed"');
    expect(fieldRun).toContain("!technicianSession && fieldEventStatusAvailable");
  });
});
