import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const repository = read("./repository.ts");
const route = read("../../app/api/presentations/route.ts");
const launcher = read(
  "../../components/presentations/new-presentation-page.tsx",
);
const workspace = read(
  "../../components/sales/sales-rep-workspace.tsx",
);
const navigation = read("./navigation.ts");
const uniquenessMigration = read(
  "../persistence/supabase/migrations/072_one_sales_lead_one_presentation.sql",
).replace(/\s+/g, " ");

describe("sales lead presentation resume contract", () => {
  it("looks up exact server-owned rep and lead lineage before creating", () => {
    expect(repository).toContain(
      "findAuthoritativePresentationForSalesLead",
    );
    expect(repository).toContain('.eq("sales_rep_id", input.salesRepId)');
    expect(repository).toContain(
      '.eq("sales_rep_lead_id", input.salesRepLeadId)',
    );
    expect(repository).toContain("selectAuthoritativeSalesLeadPresentation");
    expect(route).toContain(
      "await findAuthoritativePresentationForSalesLead",
    );
    expect(route).toContain("let presentation = existingPresentation");
    expect(route).toContain("if (!presentation)");
  });

  it("makes one presentation per field lead a database invariant and recovers the winning tab", () => {
    expect(uniquenessMigration).toContain(
      "create unique index if not exists presentations_sales_rep_lead_uidx on public.presentations(sales_rep_lead_id) where sales_rep_lead_id is not null",
    );
    expect(uniquenessMigration).toContain(
      "Duplicate sales lead presentations must be resolved before migration 072.",
    );
    const raceRecovery = route.slice(
      route.indexOf("} catch (creationError)"),
      route.indexOf("if (lineage?.leadId", route.indexOf("} catch (creationError)")),
    );
    expect(raceRecovery).toContain(
      "await findAuthoritativePresentationForSalesLead",
    );
    expect(raceRecovery).toContain("salesRepId: lineage.id");
    expect(raceRecovery).toContain("salesRepLeadId: lineage.leadId");
    expect(raceRecovery).toContain("resumed = true");
  });

  it("prefers a signed outcome and never overwrites a resumed quote", () => {
    expect(repository).toContain("selectAuthoritativeSalesLeadPresentation");
    expect(route).toContain("!leadIntake && !resumed &&");
    expect(route).toContain("let resumed = Boolean(existingPresentation)");
    expect(route).toContain("status: resumed ? 200 : 201");
    expect(route).toContain(
      'lineage?.leadId && presentation.status !== "signed"',
    );
  });

  it("opens the authoritative signed outcome or editable active draft", () => {
    expect(navigation).toContain('presentation.status === "signed"');
    expect(launcher).toContain("presentationWorkspacePath(body.presentation)");
    expect(launcher).toContain(
      "HomeAtlas will resume this homeowner’s presentation or create it once",
    );
    expect(launcher).toContain("Open homeowner presentation");
    expect(launcher).toContain("Open this homeowner");
  });

  it("moves a field lead into that idempotent presentation in one action", () => {
    expect(workspace).toContain('fetch("/api/presentations"');
    expect(workspace).toContain(
      "body: JSON.stringify({ repSlug: profile.slug, salesRepLeadId: leadId })",
    );
    expect(workspace).toContain("presentationWorkspacePath(body.presentation, {");
    expect(workspace).toContain("returnTo: profile.workspacePath");
    expect(workspace).toContain('data-intent="build-plan"');
    expect(workspace).toContain("Save & build plan");
    expect(workspace).toContain("Build their plan");
    expect(workspace).not.toContain(
      "&lead=${encodeURIComponent(lead.id)}",
    );
  });
});
