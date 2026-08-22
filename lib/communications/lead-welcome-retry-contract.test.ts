import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync(
  new URL(
    "../../app/api/admin/lead-intakes/[id]/retry-welcome/route.ts",
    import.meta.url,
  ),
  "utf8",
);

describe("lead welcome retry route contract", () => {
  it("keeps the recovery authenticated, lead-scoped, and idempotent", () => {
    expect(route).toContain("authorizeAdminRequest(request.headers)");
    expect(route).toContain("getLeadIntakeById(id.trim())");
    expect(route).toContain("runLeadAcknowledgementAutomation(lead)");
    expect(route).not.toContain("sendTwilioSms");
  });
});
