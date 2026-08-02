import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function routeSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8").replace(
    /\s+/g,
    " ",
  );
}

describe("Google Business OAuth security contract", () => {
  it("requires an HQ session before OAuth initiation", () => {
    const start = routeSource(
      "../../app/api/admin/google-reviews/oauth/start/route.ts",
    );

    expect(start).toContain("authorizeAdminRequest(request.headers)");
    expect(start).toContain('{ error: "Unauthorized" }');
  });

  it("binds the cross-site OAuth callback to the one-time state cookie", () => {
    const callback = routeSource(
      "../../app/api/admin/google-reviews/oauth/callback/route.ts",
    );

    expect(callback).toContain("readAndClearOAuthState(state)");
    expect(callback).toContain("expectedState !== state");
    expect(callback).toContain('message", "invalid_state"');
    expect(callback).not.toContain("authorizeAdminRequest(request.headers)");
  });

  it("verifies a selected location against the connected Google account", () => {
    const connect = routeSource(
      "../../app/api/admin/google-reviews/connect/route.ts",
    );

    expect(connect).toContain("listManagedGoogleBusinesses(");
    expect(connect).toContain("business.accountResourceName === accountResourceName");
    expect(connect).toContain("business.locationResourceName === locationResourceName");
  });
});
