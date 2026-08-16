import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

const server = read("./owner-pipeline-server.ts");
const assignmentControl = read(
  "../../components/admin/lead-assignment-control.tsx",
);
const route = read("../../app/api/admin/sales/pipeline/route.ts");
const page = read("../../components/admin/owner-sales-inbox-page.tsx");
const attention = read("../admin/owner-attention.ts");
const navigation = read("../navigation/config.ts");

describe("owner sales inbox release contract", () => {
  it("loads complete private roster and presentation lineage without writes", () => {
    expect(server).toContain("createPrivilegedServerSupabaseClient");
    expect(server).toContain('select(\n        "id, slug, display_name, role_title, compensation_plan",\n        { count: "exact" },');
    expect(server).toContain(".range(offset, offset + REP_PAGE_SIZE - 1)");
    expect(server).toContain("PRESENTATION_LEAD_CHUNK_SIZE");
    expect(server).toContain("loadSalesLeadAttentionSnapshot");
    expect(server).toContain("loadUnassignedInboundRequests");
    expect(server).toContain("listLeadIntakes");
    expect(server).toContain("loadLeadIntakeSalesAssignments");
    expect(server).toContain("nonfatal unassigned inbound load failed");
    expect(server).toContain("loadSalesProductionHandoffAttentionForRoster");
    expect(server).toContain("nonfatal signed handoff load failed");
    expect(server).toContain("HomeAtlas could not prove");
    expect(server).not.toMatch(/\.(?:insert|update|upsert|delete)\(/);
  });

  it("keeps owner mutations authenticated, validated, and side-effect free", () => {
    expect(route).toContain("authorizeAdminRequest(request.headers)");
    expect(route).toContain("validateUpdateSalesLead(raw.lead)");
    expect(route).toContain("updateSalesLead(repSlug, validation.value)");
    expect(route).toContain("validateRecordSalesLeadInteraction(raw.interaction)");
    expect(route).toContain('"owner",');
    expect(route).toContain("recordSalesLeadInteraction");
    expect(route).toContain('"Cache-Control": "private, no-store"');
    expect(route.toLowerCase()).not.toContain("twilio");
    expect(route.toLowerCase()).not.toContain("resend");
    expect(route.toLowerCase()).not.toContain("stripe");
  });

  it("gives HQ a direct queue and exact presentation handoff", () => {
    expect(navigation).toContain('hqSales: "/hq/sales"');
    expect(attention).toContain(
      "`${ROUTES.hqSales}#owner-sales-lead-${item.lead.id}`",
    );
    expect(page).toContain('fetch("/api/admin/sales/pipeline"');
    expect(page).toContain("SalesPhoneAccessPanel");
    expect(page).toContain("Inbound needs an owner");
    expect(page).toContain("LeadAssignmentControl");
    expect(page).toContain("snapshot.inbound");
    expect(page).toContain("Assigning does not contact the customer");
    expect(page).toContain("refusing\n          to display a false zero");
    expect(page).toContain('href="#sales-phone-access"');
    expect(page).toContain("lead.presentationHref");
    expect(page).toContain("Build presentation");
    expect(page).toContain("Resume presentation");
    expect(page).toContain("Signed → scheduled");
    expect(page).toContain("Every close stays owned until the first visit is real.");
    expect(page).toContain("handoff.actionHref");
    expect(page).toContain("handoff.repWorkspacePath");
    expect(page).toContain("PaymentSetupEmailButton");
    expect(page).toContain('handoff.paymentSetupEmailState === "ready"');
    expect(page).toContain("Sends only when pressed");
    expect(page).toContain("no charge occurs");
    expect(page).toMatch(/explicit\s+customer SMS consent/);
    expect(page).toContain("refusing to display a false zero");
    expect(page).toMatch(/Its labeled email\s+control sends only/);
    expect(page).toContain("handoffs?.summary.waitingCount");
    expect(attention).toContain('record.stage !== "payment_pending"');
    expect(page).toContain(
      "Saving does not text, email, enroll, or charge this customer.",
    );
    expect(page).not.toContain('href={`sms:');
    expect(page).not.toContain('href={`mailto:');
  });

  it("makes hot-lead assignment fast without turning it into messaging", () => {
    expect(assignmentControl).toContain("futureLocalDateTimeValue");
    expect(assignmentControl).toContain('label: "15 min"');
    expect(assignmentControl).toContain('label: "1 hour"');
    expect(assignmentControl).toContain('label: "Tomorrow 9"');
    expect(assignmentControl).toContain(
      "Assignment only. No email or text is sent.",
    );
    expect(assignmentControl).toContain("salesRepLeadWorkspaceHref");
    expect(assignmentControl).toContain("initialRepSlug");
    expect(assignmentControl).toContain("initialMinutesAhead");
    expect(assignmentControl).toContain("assignLabel");
    expect(page).toContain("Route the visible queue");
    expect(page).toContain("inboundTriageMinutesAhead(index)");
    expect(page).toContain("every assignment still requires its own deliberate tap");
    expect(page).toContain("No customer is\n              contacted here.");
    expect(page).toContain("The exact record is ready—no customer was contacted.");
    expect(page).toContain("Open owner record");
    expect(page).toContain("salesRepLeadWorkspaceHref");
    expect(assignmentControl.toLowerCase()).not.toContain("twilio");
    expect(assignmentControl.toLowerCase()).not.toContain("resend");
  });
});
