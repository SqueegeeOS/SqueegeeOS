import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workspace = readFileSync(
  new URL("../../components/sales/sales-rep-workspace.tsx", import.meta.url),
  "utf8",
);

describe("sales representative workspace activity safety", () => {
  it("requires a deliberate second step before recording a signed membership", () => {
    const quickActionHandler = workspace.match(
      /const handleQuickAction[\s\S]*?\n  };/,
    )?.[0];

    expect(quickActionHandler).toContain(
      'if (activityType === "membership_signed")',
    );
    expect(quickActionHandler).toContain("setSignedConfirmOpen(true)");
    expect(quickActionHandler).toMatch(
      /setSignedConfirmOpen\(true\);\s*return;[\s\S]*recordActivity\(activityType\)/,
    );

    expect(workspace).toContain('role="dialog"');
    expect(workspace).toContain('aria-modal="true"');
    expect(workspace).toContain("Did they sign the membership?");
    expect(workspace).toContain("Confirm only after the customer has completed the agreement.");
    expect(workspace).toContain("Yes, membership signed");
    expect(workspace).toContain('void recordActivity("membership_signed")');
  });

  it("offers undo only from the server-issued receipt for the latest entry", () => {
    expect(workspace).toContain("setUndoableActivity(body?.activity ?? null)");
    expect(workspace).toContain("undoableActivity.undoExpiresAt");
    expect(workspace).toContain(
      "Date.parse(undoableActivity.undoExpiresAt)",
    );
    expect(workspace).toContain("window.clearTimeout(timeout)");
    expect(workspace).toContain("const activityId = undoableActivity.id");
    expect(workspace).toContain(
      'body: JSON.stringify({ kind: "undo_activity", activityId })',
    );
    expect(workspace).toContain("setUndoableActivity(null)");
    expect(workspace).toContain("{undoableActivity ? (");
    expect(workspace).toContain("Undo last entry");
  });

  it("explains the recovery behavior before the operator records activity", () => {
    expect(workspace).toContain(
      "Signed asks for confirmation,\n            and the latest entry can be undone.",
    );
    expect(workspace).toContain(
      "You can undo this entry immediately if anything looks wrong.",
    );
  });
});
