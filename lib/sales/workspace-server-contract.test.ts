import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const server = readFileSync(
  new URL("./workspace-server.ts", import.meta.url),
  "utf8",
).replace(/\r\n/g, "\n");

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

  it("loads a bounded recent door history without making the field desk fail closed", () => {
    expect(server).toContain("loadRecentDoorMemories(rep.id)");
    expect(server).toContain("RECENT_DOOR_MEMORY_LIMIT = 20");
    expect(server).toContain('.from("sales_rep_door_visits")');
    expect(server).toContain('status: "unavailable"');
    expect(server).toContain("recentDoorMemories: doorMemoryResult.memories");
  });

  it("loads first-loop proof without making the field desk depend on reporting", () => {
    expect(server).toContain(
      'supabase.rpc("homeatlas_sales_rep_launch_evidence")',
    );
    expect(server).toContain("if (!launchEvidenceResult.error)");
    expect(server).toContain("salesRepLaunchCountsEvidenceFromRow");
    expect(server).toContain("unavailableSalesRepLaunchCountsEvidence");
    expect(server).toContain("launchEvidence,");
  });

  it("proves door ownership and retry identity before accepting an outcome", () => {
    expect(server).toContain(
      '.eq("client_event_id", input.doorActivityClientEventId)',
    );
    expect(server).toContain('activityResult.data.event_type !== "door_knock"');
    expect(server).toContain("activityResult.data.reversed_at");
    expect(server).toContain(
      '.eq("client_event_id", input.clientEventId)',
    );
    expect(server).toContain("assertDoorMemoryRetryMatches");
    expect(server).toContain('insertResult.error?.code !== "23505"');
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

  it("loads complete recent interaction memory and makes retries exact", () => {
    expect(server).toContain('from("sales_rep_lead_interactions")');
    expect(server).toContain("loadRecentSalesLeadInteractions");
    expect(server).toContain("SALES_LEAD_INTERACTION_PAGE_SIZE");
    expect(server).toContain(
      "HomeAtlas could not prove that the lead interaction history was complete.",
    );
    expect(server).toContain("assertLeadInteractionRetryMatches");
    expect(server).toContain('insertResult.error?.code === "23505"');
    expect(server).toContain('insertResult.error?.code === "40001"');
    expect(server).toContain("recordSalesLeadInteraction");
    expect(server).toContain("deliberately record-only");
  });

  it("restores a safe close journey without taking down the field desk", () => {
    expect(server).toContain("loadSalesLeadCloseJourneys");
    expect(server).toContain("closeJourneys.get(lead.id) ?? null");
    expect(server).toContain("nonfatal close-journey load failed");
    expect(server).toContain("nonfatal owner close-journey load failed");
  });

  it("resolves repeated mobile homeowner saves to one exact capture", () => {
    expect(server).toContain("loadSalesLeadCaptureRetry");
    expect(server).toContain("assertSalesLeadCaptureRetryMatches");
    expect(server).toContain("buildSalesLeadCaptureFingerprint");
    expect(server).toContain('.eq("client_event_id", clientEventId)');
    expect(server).toContain('error?.code === "23505"');
    expect(server).toContain('status: "already_saved"');
    expect(server).not.toContain(
      'console.error("[sales-workspace] lead activity insert failed"',
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
    expect(server).toContain("signed_agreement_id");
    expect(server).toContain("signatureBackedAttributions");
    expect(server).toContain("Boolean(attribution.signed_agreement_id)");
    expect(server).toContain("closedAttributions = signatureBackedAttributions.filter");
    expect(server).toContain("loadRecentSalesRepWins(\n      rep.id,\n      signatureBackedAttributions");
    expect(server).toContain("if (!attribution.signed_agreement_id) return []");
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
