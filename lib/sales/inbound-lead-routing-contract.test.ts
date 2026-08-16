import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

const publicLeadRoute = read("../../app/api/leads/route.ts");
const metaIngestion = read("../integrations/meta-lead-ingestion.ts");
const routingServer = read("./inbound-lead-routing-server.ts");
const pipelineServer = read("./owner-pipeline-server.ts");
const ownerPage = read("../../components/admin/owner-sales-inbox-page.tsx");
const envExample = read("../../.env.example");

describe("automatic inbound ownership release contract", () => {
  it("routes both durable inbound paths without making intake depend on routing", () => {
    expect(publicLeadRoute).toContain("routeInboundLeadToConfiguredOwner");
    expect(publicLeadRoute).toContain('storage === "supabase"');
    expect(publicLeadRoute).toContain("Promise.allSettled");
    expect(publicLeadRoute).toContain("automatic owner routing incomplete");
    expect(metaIngestion).toContain("routeInboundLeadToConfiguredOwner");
    expect(metaIngestion).toContain("automatic owner routing incomplete");
    expect(metaIngestion).toContain(".catch(() =>");
  });

  it("preserves one existing owner and creates only an assignment plus next action", () => {
    expect(routingServer).toContain("loadLeadIntakeSalesAssignment");
    expect(routingServer).toContain('status: "already_owned"');
    expect(routingServer).toContain("assignLeadIntakeToSalesRep");
    expect(routingServer).toContain("inboundLeadNextFollowUpAt");
    expect(routingServer.toLowerCase()).not.toContain("twilio");
    expect(routingServer.toLowerCase()).not.toContain("resend");
    expect(routingServer.toLowerCase()).not.toContain("stripe");
  });

  it("shows the verified route in HQ and keeps configuration explicit", () => {
    expect(pipelineServer).toContain("resolveInboundLeadRouting");
    expect(pipelineServer).toContain("INBOUND_LEAD_OWNER_ENV");
    expect(ownerPage).toContain("Future website and Facebook leads route to");
    expect(ownerPage).toContain("Routing never emails or");
    expect(ownerPage).toContain('inbound?.routing.status === "owner_unavailable"');
    expect(ownerPage).toContain('inbound?.routing.status === "not_configured"');
    expect(envExample).toContain("INBOUND_LEAD_OWNER_SLUG=noah");
  });
});
