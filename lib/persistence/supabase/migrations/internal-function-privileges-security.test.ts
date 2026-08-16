import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ");
}

const migration = read("./073_lock_internal_function_privileges.sql");
const audit = read("../../../../scripts/audit-migrations.mjs");

describe("internal privileged function security", () => {
  it("removes browser-role execution while retaining the Jobber server path", () => {
    expect(migration).toContain(
      "revoke execute on function public.acquire_jobber_refresh_lease(uuid, integer) from public, anon, authenticated",
    );
    expect(migration).toContain(
      "grant execute on function public.acquire_jobber_refresh_lease(uuid, integer) to service_role",
    );

    for (const signature of [
      "public.record_hq_admin_user_change()",
      "public.sync_hq_admin_user_auth_email()",
      "public.validate_hq_admin_user_auth_email()",
    ]) {
      expect(migration).toContain(signature);
    }
  });

  it("prevents future browser-role auto-grants by the HomeAtlas migration owner", () => {
    expect(migration).toContain(
      "alter default privileges in schema public revoke execute on functions from public, anon, authenticated",
    );
    expect(migration).toContain(
      "platform-owned supabase_admin defaults.",
    );
  });

  it("keeps the production migration ledger responsible for the privilege invariant", () => {
    expect(audit).toContain(
      '["073", "private internal database functions"',
    );
    expect(audit).toContain("publicSecurityDefinerBrowserExecutables === 0");
    expect(audit).toContain("appFunctionDefaultBrowserExecGrants === 0");
    expect(audit).toContain("jobberLeaseServiceExecute");
  });
});
