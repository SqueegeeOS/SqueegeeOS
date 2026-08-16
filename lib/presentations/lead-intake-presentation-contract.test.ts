import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const migration = read(
  "../persistence/supabase/migrations/055_lead_intake_presentation_lineage.sql",
);
const repository = read("./repository.ts");
const createRoute = read("../../app/api/presentations/route.ts");
const patchRoute = read("../../app/api/presentations/[id]/route.ts");
const inboxClient = read("../acquisition/leads/inbox-client.ts");
const customerWorkspace = read("../hq/customer-workspace/load-workspace.ts");
const assignmentRoute = read(
  "../../app/api/admin/lead-intakes/[id]/assignment/route.ts",
);
const assignmentMigration = read(
  "../persistence/supabase/migrations/077_lead_intake_sales_assignment.sql",
);

describe("lead intake presentation lineage contract", () => {
  it("enforces one private presentation for each customer inquiry", () => {
    expect(migration).toContain("presentations_lead_intake_id_fkey");
    expect(migration).toContain("references public.lead_intakes(id)");
    expect(migration).toContain("on delete restrict");
    expect(migration).toContain("presentations_lead_intake_uidx");
    expect(migration).toContain("presentations_single_origin_check");
    expect(migration).toContain("from public, anon, authenticated");
  });

  it("resolves customer identity on the server and saves before changing status", () => {
    expect(createRoute).toContain("await getLeadIntakeById");
    expect(createRoute).toContain("leadIntake?.name");
    expect(createRoute).toContain("leadIntake?.serviceAddress");
    expect(createRoute).toContain("leadIntake?.phone");
    expect(createRoute).toContain("leadIntake?.email");
    expect(createRoute).toContain("leadIntakeId: leadIntake?.id ?? null");

    const durableSave = createRoute.indexOf(
      "presentation = await createPresentation",
    );
    const intakeStatusUpdate = createRoute.indexOf(
      "await updateLeadIntakeStatus",
    );
    expect(durableSave).toBeGreaterThan(-1);
    expect(intakeStatusUpdate).toBeGreaterThan(durableSave);
  });

  it("resumes a unique record after ordinary retries or a concurrent create", () => {
    expect(repository).toContain(
      "findAuthoritativePresentationForLeadIntake",
    );
    expect(repository).toContain('.eq("lead_intake_id", input.leadIntakeId)');
    expect(createRoute).toContain("const racedPresentation = leadIntake");
    expect(createRoute).toContain("presentation = racedPresentation");
    expect(createRoute).toContain("resumed = true");
    expect(inboxClient).toContain("leadIntakeId: lead.id");
    expect(inboxClient).not.toContain(
      'updateLeadIntakeStatusClient(lead.id, "scheduled")',
    );
    expect(inboxClient).not.toContain(
      "fetch(`/api/presentations/${presentation.id}`",
    );
  });

  it("keeps lineage server-owned and makes the saved presentation discoverable", () => {
    expect(patchRoute).toContain("delete editableBody.leadIntakeId");
    expect(customerWorkspace).toContain(
      "findAuthoritativePresentationForLeadIntake",
    );
    expect(customerWorkspace).toContain('title: "Presentation ready"');
    expect(customerWorkspace).toContain(
      "presentHref: `/presentations/${linkedPresentation.id}/present`",
    );
  });

  it("requires accountable request ownership without contacting the customer", () => {
    expect(createRoute).toContain("loadLeadIntakeSalesAssignment");
    expect(createRoute).toContain(
      "Assign an owner and future next action before scheduling.",
    );
    expect(createRoute).toContain("salesRepLeadId: leadIntake ? null");
    expect(assignmentRoute).toContain("validateLeadIntakeAssignment");
    expect(assignmentRoute).not.toContain("sendCommunication");
    expect(assignmentRoute).not.toContain("createCheckoutSession");
    expect(assignmentRoute).not.toContain("stripe");
    expect(assignmentMigration).toContain("sales_rep_leads_lead_intake_uidx");
  });
});
