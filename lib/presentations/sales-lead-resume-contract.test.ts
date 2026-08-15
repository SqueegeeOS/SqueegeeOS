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
    expect(launcher).toContain('body.presentation.status === "signed"');
    expect(launcher).toContain(
      "HomeAtlas will resume this homeowner’s presentation or create it once",
    );
    expect(launcher).toContain("Open homeowner presentation");
    expect(launcher).toContain("Open this homeowner");
  });
});
