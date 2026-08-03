import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("first-of-month billing cron safety contract", () => {
  it("runs only after a successful fresh Jobber snapshot", () => {
    const route = read("../../app/api/cron/automatic-billing/route.ts");
    const syncAt = route.indexOf("await syncAllJobberData()");
    const billingAt = route.indexOf("await runAutomaticMembershipBilling");

    expect(route).toContain("process.env.CRON_SECRET");
    expect(route).toContain("timingSafeEqual");
    expect(route).toContain("isFirstBusinessDay(referenceDate)");
    expect(syncAt).toBeGreaterThan(-1);
    expect(billingAt).toBeGreaterThan(syncAt);
    expect(route.slice(syncAt, billingAt)).not.toContain(".catch(");
  });

  it("uses a separate monthly invocation and leaves no bulk lease behind", () => {
    const schedule = read("../../vercel.json");
    const route = read("../../app/api/cron/automatic-billing/route.ts");
    const executor = read("./automatic-billing-executor.ts");

    expect(schedule).toContain('"path": "/api/cron/automatic-billing"');
    expect(schedule).toContain('"schedule": "7 8 1 * *"');
    expect(route).toContain("stopClaimingAt: requestStartedAt + 270_000");
    expect(executor).toContain("Date.now() >= input.stopClaimingAt");
    expect(executor).toContain("p_limit: 1");
  });
});
