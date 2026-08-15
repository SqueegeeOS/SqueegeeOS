import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const server = readFileSync(
  new URL("./workspace-server.ts", import.meta.url),
  "utf8",
);

describe("sales workspace active-queue loading contract", () => {
  it("pages through only active leads instead of letting closed history crowd them out", () => {
    expect(server).toContain("OPEN_SALES_LEAD_STATUSES");
    expect(server).toContain('.in("status", OPEN_SALES_LEAD_STATUSES)');
    expect(server).toContain(
      '.select(SALES_LEAD_SELECT, { count: "exact" })',
    );
    expect(server).toContain(
      ".range(offset, offset + SALES_LEAD_PAGE_SIZE - 1)",
    );
    expect(server).toContain("if (offset >= result.count) return rows");
    expect(server).not.toContain(".limit(100)");
  });

  it("counts all leads captured today independently of their later outcome", () => {
    expect(server).toContain('.select("id", { count: "exact", head: true })');
    expect(server).toContain('gte("created_at", startUtc.toISOString())');
    expect(server).toContain('lt("created_at", endUtc.toISOString())');
    expect(server).toContain("if (leadsTodayResult.count === null)");
    expect(server).toContain("HomeAtlas could not verify today's lead count.");
    expect(server).toContain("leadsToday: leadsTodayResult.count");
  });

  it("fails visibly instead of presenting an unprovably partial active queue", () => {
    expect(server).toContain("if (result.count === null)");
    expect(server).toContain(
      "HomeAtlas could not prove that the active lead queue was complete.",
    );
    expect(server).toContain(
      "HomeAtlas could not finish loading the active lead queue.",
    );
  });

  it("pages the complete signed-close ledger instead of silently stopping at the provider row cap", () => {
    expect(server).toContain("SALES_ATTRIBUTION_PAGE_SIZE");
    expect(server).toContain(
      '.select(SALES_ATTRIBUTION_SELECT, { count: "exact" })',
    );
    expect(server).toContain(
      ".range(offset, offset + SALES_ATTRIBUTION_PAGE_SIZE - 1)",
    );
    expect(server).toContain(
      "HomeAtlas could not prove that the signed-close ledger was complete.",
    );
    expect(server).toContain("loadAllSalesRepAttributionRows(rep.id)");
  });

  it("derives the visible close ledger only from signature-backed attribution rows", () => {
    expect(server).toContain("selectRecentSalesRepWinSources");
    expect(server).toContain("loadRecentSalesRepWins(");
    expect(server).toContain('.eq("rep_id", repId)');
    expect(server).toContain('.eq("sales_rep_id", repId)');
    expect(server).toContain('recentWinsStatus = "unavailable"');
    expect(server).not.toContain("recentWins: openLeadRows");
  });

  it("joins each signed close to the read-only production handoff without hiding a handoff failure", () => {
    expect(server).toContain("membership_id");
    expect(server).toContain("loadSalesProductionHandoffSnapshotForAttributions");
    expect(server).toContain('productionHandoffStatus = "unavailable"');
    expect(server).toContain("productionHandoffs");
  });

  it("keeps the owner handoff snapshot free of attribution repair writes", () => {
    const start = server.indexOf(
      "export async function loadSalesProductionHandoffAttentionSnapshot",
    );
    const end = server.indexOf(
      "export async function loadSalesLeadAttentionSnapshot",
      start,
    );
    const loader = server.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(loader).toContain("loadAllSalesRepAttributionRows");
    expect(loader).not.toContain("reconcileSignedMembershipAttributionsForRep");
    expect(loader).not.toMatch(/\.(?:insert|update|upsert|delete)\(/);
  });
});
