import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

const route = read("../../app/api/admin/enrollment-packets/route.ts");
const statusServer = read("./packet-status-server.ts");
const handoff = read("../../components/enrollment/remote-enrollment-handoff.tsx");
const fieldWorkspace = read("../../components/sales/sales-rep-workspace.tsx");
const ownerWorkspace = read("../../components/admin/owner-sales-inbox-page.tsx");

describe("durable enrollment progress contract", () => {
  it("returns a private, ownership-checked, status-only snapshot", () => {
    expect(route).toContain("export async function GET(request: Request)");
    expect(route).toContain(
      "authorizeSalesPresentationRequest(request.headers, presentationId)",
    );
    expect(route).toContain("loadEnrollmentPacketStatus(presentationId)");
    expect(route).toContain('"Cache-Control": "private, no-store, max-age=0"');
    expect(statusServer).toContain('.select("status, updated_at")');
    expect(statusServer).toContain('.eq("presentation_id", presentationId)');
    expect(statusServer).not.toContain("customer_email");
    expect(statusServer).not.toContain("docusign_envelope_id");
  });

  it("restores the secure handoff before rendering another send action", () => {
    expect(handoff).toContain("Checking secure handoff");
    expect(handoff).toContain("cache: \"no-store\"");
    expect(handoff).toContain("setPacketStatus(nextStatus)");
    expect(handoff).toContain("durableProgress.blocksNewSend");
    expect(handoff).toContain("Return to field desk");
    expect(handoff).toContain("Open Enrollment Desk");
    expect(handoff).toContain("The send remains server-protected and idempotent.");
    expect(handoff).not.toContain("useState(false);\n  const [sent");
  });

  it("shows the same next close step to David and HQ", () => {
    expect(fieldWorkspace).toContain("Close journey · {lead.closeJourney.label}");
    expect(fieldWorkspace).toContain("lead.closeJourney?.actionLabel");
    expect(ownerWorkspace).toContain("Close journey · {lead.closeJourney.label}");
    expect(ownerWorkspace).toContain("lead.closeJourney?.actionLabel");
  });

  it("does not introduce automatic email, text, or payment effects", () => {
    expect(handoff).toContain("onClick={send}");
    expect(handoff).not.toContain("setInterval(");
    expect(handoff.toLowerCase()).not.toContain("twilio");
    expect(route).not.toContain("paymentIntents.create");
  });
});
