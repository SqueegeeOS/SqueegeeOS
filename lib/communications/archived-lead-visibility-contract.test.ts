import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const leadRepository = readFileSync(
  new URL("../acquisition/leads/repository.ts", import.meta.url),
  "utf8",
);
const communicationsRepository = readFileSync(
  new URL("./repository.ts", import.meta.url),
  "utf8",
);
const requestsInbox = readFileSync(
  new URL("../../components/admin/pending-requests-inbox.tsx", import.meta.url),
  "utf8",
);
const removeRoute = readFileSync(
  new URL(
    "../../app/api/admin/lead-intakes/[id]/remove/route.ts",
    import.meta.url,
  ),
  "utf8",
);

describe("safe test and fake lead removal", () => {
  it("archives the linked conversation when a lead is archived", () => {
    expect(leadRepository).toContain("removeLeadIntakeFromActiveHq");
    expect(leadRepository).toContain('.update({ status: "archived" })');
    expect(leadRepository).toContain('.from("customer_conversations")');
    expect(leadRepository).toContain('.eq("lead_intake_id", id)');
  });

  it("keeps archived conversations out of the active customer inbox", () => {
    expect(communicationsRepository).toContain('.neq("status", "archived")');
  });

  it("requires confirmation and explains that audit history is preserved", () => {
    expect(requestsInbox).toContain("Remove test/fake");
    expect(requestsInbox).toContain("window.confirm");
    expect(requestsInbox).toContain("instead of erasing consent or message history");
  });

  it("keeps the cleanup mutation behind HQ authorization", () => {
    expect(removeRoute).toContain("authorizeAdminRequest(request.headers)");
    expect(removeRoute).toContain('"Cache-Control": "private, no-store"');
  });
});
