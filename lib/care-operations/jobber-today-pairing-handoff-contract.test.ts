import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const today = read("../../components/admin/today-workspace-page.tsx");
const jobberPanel = read(
  "../../components/admin/jobber-visit-workspace-panel.tsx",
);
const connection = read("../../components/admin/jobber-connection-panel.tsx");
const oauthState = read("./jobber-oauth-state.ts");
const propertyMatching = read("./jobber-property-matching.ts");
const visitSync = read("./jobber-visit-sync.ts");
const callback = read(
  "../../app/api/admin/care-operations/jobber/oauth/callback/route.ts",
);

describe("Today to supervised Jobber pairing continuity", () => {
  it("carries the exact visit without writing a match on navigation", () => {
    expect(today).toContain("jobberTodayPairingHref(visit.projectionId)");
    expect(today).toContain("Pair this exact stop");
    expect(jobberPanel).toContain(
      'params.set("projectionId", focusProjectionId)',
    );
    expect(jobberPanel).toContain(
      "jobberVisitWorkspaceAnchorId(visit.projectionId)",
    );
    expect(propertyMatching).toContain("projectionId: focusProjectionId");
    expect(visitSync).toContain('query = query.eq("id", projectionId)');
    expect(jobberPanel).toContain("samePhysicalPropertyConfirmed");
    expect(jobberPanel).not.toMatch(/paymentIntents\.create|paymentIntents\.confirm/);
  });

  it("keeps the handoff through a reconnect and provides a safe way back", () => {
    expect(connection).toContain("jobberHandoffResumeHref(focus)");
    expect(oauthState).toContain("resolveJobberHandoffResumePath(returnTo)");
    expect(callback).toContain("oauthState.returnTo");
    expect(jobberPanel).toContain("Return to Today");
    expect(jobberPanel).toContain("focusReturnTo");
  });
});
