import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const migration = read(
  "../persistence/supabase/migrations/067_sales_rep_phone_access.sql",
);
const proxy = read("../../proxy.ts");
const access = read("./sales-access.ts");
const dal = read("./sales-access-dal.ts");
const workspaceRoute = read("../../app/api/sales/[repSlug]/workspace/route.ts");
const presentationRoute = read("../../app/api/presentations/route.ts");
const presentationIdRoute = read("../../app/api/presentations/[id]/route.ts");
const planAssistantRoute = read(
  "../../app/api/presentations/plan-assistant/route.ts",
);
const signRoute = read("../../app/api/sign-agreement/route.ts");
const enrollmentRoute = read(
  "../../app/api/admin/enrollment-packets/route.ts",
);
const adminGrantRoute = read(
  "../../app/api/admin/sales/access-grants/route.ts",
);
const davidPage = read("../../app/david/page.tsx");
const editPage = read("../../app/presentations/[id]/edit/page.tsx");
const presentPage = read("../../app/presentations/[id]/present/page.tsx");
const newPresentation = read(
  "../../components/presentations/new-presentation-page.tsx",
);
const accessPanel = read("../../components/admin/sales-phone-access-panel.tsx");
const salesInbox = read("../../components/admin/owner-sales-inbox-page.tsx");

describe("sales phone-pass least-privilege contract", () => {
  it("stores hashes only and grants the table and RPCs only to service_role", () => {
    expect(migration).toContain("invite_token_hash text not null unique");
    expect(migration).toContain("session_token_hash text unique");
    expect(migration).not.toMatch(/invite_token\s+text/);
    expect(migration).not.toMatch(/session_token\s+text/);
    expect(migration).toContain(
      "alter table public.sales_rep_access_grants enable row level security",
    );
    expect(migration).toContain(
      "revoke all privileges on table public.sales_rep_access_grants",
    );
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("issue_sales_rep_access_grant");
    expect(migration).toContain("claim_sales_rep_access_grant");
    expect(migration).toContain("revoke_sales_rep_access_grant");
    expect(migration).toContain("to service_role");
  });

  it("uses separate one-time and revocable credentials and rechecks active reps", () => {
    expect(access).toContain('randomBytes(32).toString("base64url")');
    expect(access).toContain("hashSalesAccessToken(inviteToken)");
    expect(access).toContain("hashSalesAccessToken(sessionToken)");
    expect(migration).toContain("and grant_row.claimed_at is null");
    expect(migration).toContain("and grant_row.invite_expires_at > now()");
    expect(migration).toContain("and rep.status = 'active'");
    expect(access).toContain('.eq("status", "active")');
    expect(access).toContain('.gt("session_expires_at"');
  });

  it("uses Proxy optimistically and authorizes pages and APIs at the data boundary", () => {
    expect(proxy).toContain("optimistic cookie-presence check");
    expect(proxy).toContain("SALES_SESSION_COOKIE_NAME");
    expect(proxy).not.toContain("createServiceRoleSupabaseClient");
    expect(davidPage).toContain("requireSalesWorkspacePageActor");
    expect(editPage).toContain("requireSalesPresentationPageActor");
    expect(presentPage).toContain("requireSalesPresentationPageActor");
    expect(dal).toContain("salesActorOwnsPresentation");
    expect(workspaceRoute).toContain("authorizeSalesRepRequest");
    expect(presentationIdRoute).toContain(
      "authorizeSalesPresentationRequest",
    );
    expect(planAssistantRoute).toContain(
      "authorizeSalesPresentationRequest",
    );
  });

  it("binds creation, signature, and remote handoff to the rep-owned presentation", () => {
    expect(presentationRoute).toContain("canSalesActorAccessRep");
    expect(presentationRoute).toContain('actor.kind === "sales_rep"');
    expect(signRoute).toContain("salesActorOwnsPresentation");
    expect(signRoute).toContain(
      "This phone pass can sign only its own presentation.",
    );
    expect(enrollmentRoute).toContain(
      "authorizeSalesPresentationRequest",
    );
    expect(presentationIdRoute).toContain("delete editableBody.agreementId");
    expect(presentationIdRoute).toContain("delete editableBody.membershipId");
    expect(newPresentation).toContain("preauthorized");
  });

  it("keeps pass issuance founder-only and side-effect free", () => {
    expect(adminGrantRoute).toContain("authorizeAdminRequest(request.headers)");
    expect(adminGrantRoute).toContain("issueSalesRepPhonePass");
    expect(adminGrantRoute).toContain("revokeSalesRepPhonePass");
    expect(adminGrantRoute).not.toContain("twilio");
    expect(adminGrantRoute).not.toContain("resend");
    expect(adminGrantRoute).not.toContain("stripe");
  });

  it("puts truthful activation and first-loop proof in the owner sales cockpit", () => {
    expect(salesInbox).toContain("SalesPhoneAccessPanel");
    expect(accessPanel).toContain('id="sales-phone-access"');
    expect(accessPanel).toContain("deriveSalesRepLaunchReadiness");
    expect(access).toContain('.rpc("homeatlas_sales_rep_launch_evidence")');
    expect(accessPanel).not.toContain("twilio");
    expect(accessPanel).not.toContain("resend");
    expect(accessPanel).not.toContain("stripe");
  });
});
