import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readProjectFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("customer data route boundaries", () => {
  it("protects presentation reads and writes at the route handler", () => {
    for (const route of [
      "app/api/presentations/route.ts",
      "app/api/presentations/[id]/route.ts",
      "app/api/presentations/plan-assistant/route.ts",
    ]) {
      const source = readProjectFile(route);
      expect(source).toContain("authorizeAdminRequest");
      expect(source).toMatch(
        /authorizeAdminRequest\((?:req|request)\.headers\)/,
      );
    }
  });

  it("does not query presentation records in anonymous server pages", () => {
    for (const page of [
      "app/presentations/page.tsx",
      "app/presentations/new/page.tsx",
      "app/presentations/[id]/edit/page.tsx",
      "app/presentations/[id]/present/page.tsx",
    ]) {
      const source = readProjectFile(page);
      expect(source).not.toContain('from "@/lib/presentations/repository"');
    }
  });

  it("removes the browser-exposed PIN variable from every auth boundary", () => {
    expect(
      readProjectFile("components/admin/admin-pin-gate.tsx"),
    ).not.toContain("NEXT_PUBLIC_ADMIN_PIN");
    expect(readProjectFile("lib/admin/pin.ts")).not.toContain(
      "NEXT_PUBLIC_ADMIN_PIN",
    );
    expect(readProjectFile("lib/admin/pin.ts")).not.toContain(
      "ADMIN_PIN_SESSION_KEY",
    );
    expect(readProjectFile("lib/admin/server-auth.ts")).not.toContain(
      "NEXT_PUBLIC_ADMIN_PIN",
    );
  });

  it("routes browser Home Care Plan persistence through an authenticated API", () => {
    const route = readProjectFile("app/api/admin/home-care-plans/route.ts");
    const adapter = readProjectFile("lib/persistence/adapters/supabase.ts");
    const presentationPage = readProjectFile(
      "app/homecare/[homeownerSlug]/[propertySlug]/plan/page.tsx",
    );

    expect(route).toContain("authorizeAdminRequest");
    expect(route).toContain("isServiceRoleConfigured");
    expect(adapter).not.toContain("createBrowserSupabaseClient");
    expect(presentationPage).not.toContain("supabaseAdapter");
  });

  it("revokes anonymous access to all customer authority tables", () => {
    const authorityMigration = readProjectFile(
      "lib/persistence/supabase/migrations/038_close_customer_anon_access.sql",
    );
    const leadMigration = readProjectFile(
      "lib/persistence/supabase/migrations/040_close_lead_intake_anon_access.sql",
    );
    const tables = [
      "homeowners",
      "properties",
      "home_care_plans",
      "memberships",
      "signed_agreements",
      "property_assets",
    ];

    for (const table of tables) {
      expect(authorityMigration).toContain(
        `revoke all privileges on table public.${table} from public, anon, authenticated`,
      );
    }

    expect(leadMigration).toContain(
      "revoke all privileges on table public.lead_intakes",
    );
    expect(leadMigration).toContain("('lead_intakes')");
    expect(authorityMigration).toContain("admin_unlock_rate_limits");
    expect(authorityMigration).toContain("check_admin_unlock_rate_limit");
  });

  it("keeps communication content private to service-role routes", () => {
    const migration = readProjectFile(
      "lib/persistence/supabase/migrations/041_customer_communications.sql",
    );
    for (const table of [
      "customer_contact_points",
      "customer_communication_automation_rules",
      "customer_conversations",
      "customer_messages",
      "customer_communication_webhook_events",
    ]) {
      expect(migration).toContain(
        `revoke all privileges on table public.${table}`,
      );
      expect(migration).toContain(`('${table}')`);
    }
  });

  it("keeps communications launch diagnostics behind HQ authorization", () => {
    const source = readProjectFile(
      "app/api/admin/communications/readiness/route.ts",
    );
    expect(source).toContain("authorizeAdminRequest");
    expect(source).toContain("authorizeAdminRequest(request.headers)");
    expect(source).toContain('"Cache-Control": "private, no-store"');
  });

  it("keeps the owner attention queue behind HQ authorization", () => {
    const source = readProjectFile("app/api/admin/attention/route.ts");
    expect(source).toContain("authorizeAdminRequest(request.headers)");
    expect(source).toContain('"Cache-Control": "private, no-store"');
  });

  it("keeps membership history while allowing only one current plan", () => {
    const migration = readProjectFile(
      "lib/persistence/supabase/migrations/039_preserve_membership_history.sql",
    );
    const onboarding = readProjectFile(
      "lib/membership/complete-sign-onboarding.ts",
    );

    expect(migration).toContain("drop constraint if exists memberships_property_id_key");
    expect(migration).toContain("memberships_one_current_per_property_idx");
    expect(migration).toContain("where status in");
    expect(onboarding).not.toContain('{ onConflict: "property_id" }');
    expect(onboarding).toContain("already has a current membership");
  });

  it("does not acknowledge Jobber events before a completed snapshot", () => {
    const webhook = readProjectFile("lib/integrations/jobber-webhook.ts");
    const cron = readProjectFile("app/api/cron/jobber-reconcile/route.ts");
    const schedule = readProjectFile("vercel.json");

    expect(webhook).not.toContain("coalesced_with_recent_sync");
    expect(webhook).toContain("covered_by_completed_full_snapshot");
    expect(cron).toContain("process.env.CRON_SECRET");
    expect(cron).toContain("timingSafeEqual");
    expect(schedule).toContain("/api/cron/jobber-reconcile");
    expect(schedule).toContain('"schedule": "17 17 * * *"');
    expect(cron).toContain("processDueScheduledCommunications");
    expect(cron).toContain("processVerifiedAppointmentReminders");
  });

  it("derives signing identity from the stored presentation", () => {
    const route = readProjectFile("app/api/sign-agreement/route.ts");
    expect(route).toContain("scopedPresentationSlug");
    expect(route).toContain("hasCompleteClientAddress");
    expect(route).toContain("status: 422");
  });

  it("protects operator pages before their server components run", () => {
    const source = readProjectFile("proxy.ts");

    for (const route of [
      "/hq/:path+",
      "/david/:path*",
      "/sales/:path*",
      "/employee/:path*",
      "/tech/:path*",
      "/properties/:path*",
      "/setup/:path*",
      "/experience/:path*",
      "/homecare/:path*",
    ]) {
      expect(source).toContain(`"${route}"`);
    }

    expect(source).toContain("verifyAdminSessionToken");
  });

  it("keeps sales workspace reads and writes behind server authorization", () => {
    const route = readProjectFile(
      "app/api/sales/[repSlug]/workspace/route.ts",
    );
    const migration = readProjectFile(
      "lib/persistence/supabase/migrations/048_sales_rep_workspace.sql",
    );

    expect(route).toContain("authorizeAdminRequest(request.headers)");
    for (const table of [
      "sales_reps",
      "sales_rep_leads",
      "sales_rep_activity_events",
      "sales_rep_attributions",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(migration).toContain(
        `revoke all privileges on table public.${table}`,
      );
    }
  });

  it("authorizes payment changes with an admin session or portal token", () => {
    for (const route of [
      "app/api/stripe/setup-intent/route.ts",
      "app/api/membership/setup-payment/route.ts",
    ]) {
      expect(readProjectFile(route)).toContain("authorizeMembershipAction");
    }
  });

  it("protects the Jobber Today schedule at the route handler", () => {
    const source = readProjectFile(
      "app/api/admin/care-operations/jobber/today/route.ts",
    );
    expect(source).toContain("authorizeAdminRequest");
    expect(source).toMatch(/authorizeAdminRequest\(request\.headers\)/);
  });

  it("protects visit field-record uploads and commits at the route handler", () => {
    for (const route of [
      "app/api/admin/field-records/upload-intents/route.ts",
      "app/api/admin/field-records/route.ts",
      "app/api/admin/field-records/follow-ups/route.ts",
    ]) {
      const source = readProjectFile(route);
      expect(source).toContain("authorizeAdminRequest(request.headers)");
      expect(source).toContain('"Cache-Control": "private, no-store"');
    }
  });

  it("protects source-backed growth truth at the route handler", () => {
    const source = readProjectFile("app/api/admin/growth/route.ts");
    expect(source).toContain("authorizeAdminRequest");
    expect(source).toContain("authorizeAdminRequest(request.headers)");
  });

  it("protects aftercare reads and dispositions at the route handler", () => {
    const source = readProjectFile("app/api/admin/aftercare/route.ts");
    expect(source).toContain("authorizeAdminRequest(request.headers)");
    expect(source).toContain('"Cache-Control": "private, no-store"');
    expect(source).toContain("recordCustomerAftercareOutcome");
    expect(source).toContain("recordCustomerServiceCaseAction");
  });

  it("binds customer service-case intake to a portal token header", () => {
    const source = readProjectFile("app/api/portal/service-cases/route.ts");
    const actions = readProjectFile(
      "lib/service-cases/customer-service-case-actions-server.ts",
    );
    expect(source).toContain('request.headers.get("x-portal-token")');
    expect(source).toContain("resolvePortalAccessByToken");
    expect(source).toContain('"Cache-Control": "private, no-store"');
    expect(actions).toContain("input.access.membershipId");
    expect(actions).not.toMatch(/twilio|resend|sendoutboundcommunication/i);
  });

  it("scopes the multi-property portal projection to the proven homeowner", () => {
    const source = readProjectFile(
      "lib/persistence/queries/portal-household.ts",
    );
    expect(source).toContain('.eq("homeowner_id", access.homeownerId)');
    expect(source).toContain('"pending_checkout"');
    expect(source).toContain('"pending_payment"');
    expect(source).toContain('"active"');
    expect(source).toContain('"paused"');
    expect(source).not.toMatch(/\.(?:insert|update|upsert|delete)\(/);
  });
});
