import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./production-handoff-server.ts", import.meta.url),
  "utf8",
);

describe("sales production handoff loader contract", () => {
  it("reads each durable handoff proof without mutating customer or provider state", () => {
    expect(source).toContain('.from("memberships")');
    expect(source).toContain('.from("presentations")');
    expect(source).toContain('.from("signed_agreements")');
    expect(source).toContain('.from("jobber_property_links")');
    expect(source).toContain('.from("jobber_membership_job_links")');
    expect(source).toContain('.from("jobber_visit_projections")');
    expect(source).toContain("readJobberConnectionStatus");
    expect(source).not.toMatch(/\.(?:insert|update|upsert|delete)\(/);
    expect(source).not.toContain("getFreshJobberAccessToken");
  });

  it("proves the exact signed payment-email lineage before enabling contact", () => {
    expect(source).toContain("resolveSalesPaymentSetupEmailState");
    expect(source).toContain("signedAgreementId: attribution.signedAgreementId");
  });

  it("uses exact paginated reads instead of silently trusting a provider row cap", () => {
    expect(source).toContain('{ count: "exact" }');
    expect(source).toContain("loadCompletePages");
    expect(source).toContain(".range(from, to)");
    expect(source).toContain("if (result.count === null)");
    expect(source).toContain("if (page.length === 0)");
  });

  it("fails schedule proof closed when Jobber is disconnected or stale", () => {
    expect(source).toContain("isJobberTodayDataStale");
    expect(source).toContain("connection.connected");
    expect(source).toContain('scheduleSource.fresh ? "fresh" : "unavailable"');
    expect(source).toContain("const visits = scheduleSource.fresh");
  });
});
