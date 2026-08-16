import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const server = readFileSync(
  new URL("./lead-close-journey-server.ts", import.meta.url),
  "utf8",
).replace(/\r\n/g, "\n");

describe("field close journey server contract", () => {
  it("keeps every presentation lookup scoped to the exact representative", () => {
    expect(server).toContain('.eq("sales_rep_id", repId)');
    expect(server).toContain('.in(column, valueChunk)');
    expect(server).toContain('"sales_rep_lead_id"');
    expect(server).toContain('"lead_intake_id"');
  });

  it("loads only safe operational fields and never customer or provider secrets", () => {
    expect(server).toContain(
      '.select("id, sales_rep_lead_id, lead_intake_id, status, updated_at")',
    );
    expect(server).toContain(
      '.select("presentation_id, status, updated_at")',
    );
    expect(server).not.toContain("customer_email");
    expect(server).not.toContain("docusign_envelope_id");
    expect(server).not.toContain("stripe_payment_method_id");
    expect(server).not.toMatch(/\.(?:insert|update|upsert|delete)\(/);
  });

  it("maps each lead to one server-derived journey", () => {
    expect(server).toContain("buildSalesLeadCloseJourney");
    expect(server).toContain("journeys.set(");
    expect(server).toContain("packetsByPresentationId");
  });
});
