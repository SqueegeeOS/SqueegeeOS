import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const migration = read(
  "../persistence/supabase/migrations/057_technician_field_access.sql",
);
const persistentMigration = read(
  "../persistence/supabase/migrations/20260904000542_persistent_technician_access.sql",
);
const proxy = read("../../proxy.ts");
const access = read("./field-access.ts");
const scope = read("./field-scope.ts");
const techHome = read("../../app/tech/page.tsx");
const techProperties = read("../../app/tech/properties/page.tsx");
const techProperty = read("../../app/tech/properties/[id]/page.tsx");
const fieldToday = read("../../app/api/field/today/route.ts");
const fieldCommit = read("../../app/api/field/field-records/route.ts");
const fieldUploads = read(
  "../../app/api/field/field-records/upload-intents/route.ts",
);
const fieldVisitEvents = read(
  "../../app/api/field/visit-events/route.ts",
);
const adminGrantRoute = read(
  "../../app/api/admin/technicians/access-grants/route.ts",
);
const accessPage = read("../../app/tech/access/page.tsx");
const accessAdmin = read("../../components/admin/technician-access-page.tsx");
const fieldWorkspace = read(
  "../../components/field/technician-today-workspace.tsx",
);

describe("technician Field Pass security contract", () => {
  it("stores hashes only and exposes all grant mutations only to service_role", () => {
    expect(migration).toContain("invite_token_hash text not null unique");
    expect(migration).toContain("session_token_hash text unique");
    expect(migration).not.toMatch(/invite_token\s+text/);
    expect(migration).not.toMatch(/session_token\s+text/);
    expect(migration).toContain(
      "revoke all privileges on table public.technician_access_grants",
    );
    expect(migration).toContain("to service_role");
    expect(migration).toContain("issue_technician_access_grant");
    expect(migration).toContain("claim_technician_access_grant");
    expect(migration).toContain("revoke_technician_access_grant");
  });

  it("uses separate one-time invite and revocable session credentials", () => {
    expect(access).toContain("randomBytes(32).toString(\"base64url\")");
    expect(access).toContain("hashFieldAccessToken(inviteToken)");
    expect(access).toContain("hashFieldAccessToken(sessionToken)");
    expect(migration).toContain("and grant_row.claimed_at is null");
    expect(migration).toContain("and grant_row.invite_expires_at > now()");
    expect(access).toContain('.eq("status", "active")');
    expect(access).toContain('.gt("session_expires_at"');
  });

  it("uses Proxy only optimistically and authorizes near every field data source", () => {
    expect(proxy).toContain("optimistic presence check");
    expect(proxy).toContain("FIELD_SESSION_COOKIE_NAME");
    expect(proxy).not.toContain("createServiceRoleSupabaseClient");
    expect(techHome).toContain("requireFieldPageActor");
    expect(techProperties).toContain('redirect("/tech")');
    expect(techProperties).not.toContain("listTechnicianProperties");
    expect(techProperty).toContain("requireFieldPropertyPageActor");
    expect(fieldToday).toContain("authorizeFieldRequest(request.headers)");
    expect(fieldCommit).toContain("authorizeFieldRequest(request.headers)");
    expect(fieldUploads).toContain("authorizeFieldRequest(request.headers)");
    expect(fieldVisitEvents).toContain(
      "authorizeFieldRequest(request.headers)",
    );
  });

  it("fails closed on unknown Jobber assignments and rechecks writes", () => {
    expect(scope).toContain('visit.assignmentReadState === "available"');
    expect(scope).toContain("assertTechnicianAssignedToAppointment");
    expect(scope).toContain("This Jobber stop is not assigned to this Field Pass");
    expect(fieldCommit).toContain("assertFieldActorCanWriteAppointment");
    expect(fieldUploads).toContain("assertFieldActorCanWriteAppointment");
    expect(fieldVisitEvents).toContain("assertFieldActorCanWriteAppointment");
    expect(fieldCommit).toContain("technicianName: actor.displayName");
  });

  it("omits customer portal bearer paths and HQ follow-up notes from field DTOs", () => {
    expect(scope).toContain("jobberClientWebUri: null");
    expect(scope).toContain("homeAtlasMembershipId: null");
    expect(scope).toContain("homeAtlasPortalPath: null");
    expect(scope).toContain("fieldFollowUps: []");
  });

  it("keeps pass issuance an HQ-only, non-messaging action", () => {
    expect(adminGrantRoute).toContain("authorizeAdminRequest(request.headers)");
    expect(adminGrantRoute).toContain("issueTechnicianFieldPass");
    expect(adminGrantRoute).toContain("revokeTechnicianFieldPass");
    expect(adminGrantRoute).not.toContain("twilio");
    expect(adminGrantRoute).not.toContain("resend");
  });

  it("keeps an active pass visible even after its user leaves the recent roster", () => {
    expect(access).toContain("if (observedCrew.has(jobberUserId)) continue");
    expect(access).toContain("observedStopCount: 0");
    expect(access).toContain("currentGrantByUser");
  });

  it("adds the new identity table to HomeAtlas privacy posture", () => {
    expect(migration).toContain("('technician_access_grants')");
    expect(migration).toContain("create or replace function public.homeatlas_security_posture()");
  });

  it("allows private HomeAtlas technician identities without sharing a Jobber seat", () => {
    expect(persistentMigration).toContain("public.homeatlas_technicians");
    expect(access).toContain("homeatlas:");
    expect(access).toContain("Choose an active HomeAtlas technician");
  });

  it("makes technician reconnection obvious and guards against accidental removal", () => {
    expect(accessAdmin).toContain("Reconnect by text");
    expect(accessAdmin).toContain("sendInstallLink(nextPass)");
    expect(accessPage).toContain("Text HQ for new access");
    expect(accessPage).toContain("Technician Access does not use a password");
    expect(fieldWorkspace).toContain("Remove this phone");
    expect(fieldWorkspace).toContain("window.confirm");
    expect(fieldWorkspace).toContain("need HQ to text you a new private link");
  });
});
