import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const server = read("./owner-pipeline-server.ts");
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
    expect(server).toContain("HomeAtlas could not prove");
    expect(server).not.toMatch(/\.(?:insert|update|upsert|delete)\(/);
  });

  it("keeps owner mutations authenticated, validated, and side-effect free", () => {
    expect(route).toContain("authorizeAdminRequest(request.headers)");
    expect(route).toContain("validateUpdateSalesLead(raw.lead)");
    expect(route).toContain("updateSalesLead(repSlug, validation.value)");
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
    expect(page).toContain("lead.presentationHref");
    expect(page).toContain("Build presentation");
    expect(page).toContain("Resume presentation");
    expect(page).toContain(
      "Saving does not text, email, enroll, or charge this customer.",
    );
    expect(page).not.toContain('href={`sms:');
    expect(page).not.toContain('href={`mailto:');
  });
});
