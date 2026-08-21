import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const processor = readFileSync(
  new URL("./review-request-automation-server.ts", import.meta.url),
  "utf8",
);
const cron = readFileSync(
  new URL("../../app/api/cron/jobber-reconcile/route.ts", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL(
    "../persistence/supabase/migrations/087_completed_visit_review_requests.sql",
    import.meta.url,
  ),
  "utf8",
).replace(/\s+/g, " ");

describe("completed-visit review request automation contract", () => {
  it("installs a founder-controlled rule that starts off", () => {
    expect(migration).toContain("'review_request_after_visit'");
    expect(migration).toMatch(
      /'review_request_after_visit_sms', 'review_request_after_visit', 'sms', false, true, true, 1440,/,
    );
    expect(migration).toContain("'review_policy', 'honest_feedback_only'");
  });

  it("requires evidence, consent, provider readiness, and one-send idempotency", () => {
    expect(processor).toContain("loadCustomerAftercareSnapshot");
    expect(processor).toContain('destination.verificationStatus !== "verified"');
    expect(processor).toContain('destination.consentStatus !== "opted_in"');
    expect(processor).toContain("getCommunicationAutomationReadiness");
    expect(processor).toContain("buildReviewRequestSmsPlan");
    expect(processor).toContain("recordCustomerAftercareOutcome");
  });

  it("runs only after fresh Jobber reconciliation", () => {
    expect(cron.indexOf("const sync = await syncAllJobberData()"))
      .toBeLessThan(cron.indexOf("processEligibleReviewRequests()"));
  });
});
