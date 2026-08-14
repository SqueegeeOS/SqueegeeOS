import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workspace = readFileSync(
  new URL("../../components/sales/sales-rep-workspace.tsx", import.meta.url),
  "utf8",
);

describe("sales representative workspace activity safety", () => {
  it("never exposes a manual signed-membership counter", () => {
    expect(workspace).not.toContain('type: "membership_signed"');
    expect(workspace).not.toContain('recordActivity("membership_signed")');
    expect(workspace).not.toContain("Yes, membership signed");
    expect(workspace).toContain("Signed memberships &middot; automatic");
    expect(workspace).toContain(
      "Completed HomeAtlas agreements credit {profile.displayName} automatically.",
    );
    expect(workspace).toContain("metrics.closedArrTodayCents");
  });

  it("offers undo only from the server-issued receipt for the latest entry", () => {
    expect(workspace).toContain("setUndoableActivity(body?.activity ?? null)");
    expect(workspace).toContain("undoableActivity.undoExpiresAt");
    expect(workspace).toContain(
      "Date.parse(undoableActivity.undoExpiresAt)",
    );
    expect(workspace).toContain("window.clearTimeout(timeout)");
    expect(workspace).toContain("const activityId = activity.id");
    expect(workspace).toContain(
      'body: JSON.stringify({ kind: "undo_activity", activityId })',
    );
    expect(workspace).toContain("current?.id === activityId ? null : current");
    expect(workspace).toContain("{undoableActivity ? (");
    expect(workspace).toContain('aria-label="Undo the last field pulse entry"');
  });

  it("keeps weak-network pulses device-local until an idempotent sync succeeds", () => {
    expect(workspace).toContain("OFFLINE_PULSE_STORAGE_KEY");
    expect(workspace).toContain("const clientEventId = crypto.randomUUID()");
    expect(workspace).toContain("requestController.abort()");
    expect(workspace).toContain("4_000");
    expect(workspace).toContain("occurredAt: offlineEntry.createdAt");
    expect(workspace).toContain("Not synced to HomeAtlas yet.");
    expect(workspace).toContain("Remove last");
    expect(workspace).toContain('window.addEventListener("online", handleOnline)');
    expect(workspace).toContain("return true;");
    expect(workspace).toContain("return false;");
    expect(workspace).toContain("if (!commitOfflineQueue(next))");
    expect(workspace).toContain("offlineQueueRef.current.filter(");
    expect(workspace).toContain("discardOldestQueuedActivity");
    expect(workspace).toContain("Discard oldest");
    expect(workspace).toContain(
      "current?.clientEventId === entry.clientEventId",
    );
    expect(workspace).toContain("Sync needs attention.");
    expect(workspace).toContain("safe idempotent retry");
  });

  it("provides a high-contrast, one-hand field surface", () => {
    expect(workspace).toContain("FIELD_DISPLAY_STORAGE_KEY");
    expect(workspace).toContain('aria-pressed={sunlightMode}');
    expect(workspace).toContain("One-hand field pulse");
    expect(workspace).toContain("Next door");
    expect(workspace).toContain("fixed inset-x-0 bottom-0");
    expect(workspace).toContain('recordActivity("door_knock", "fixed-door")');
    expect(workspace).toContain("fixedDoorFeedback");
    expect(workspace).toContain("Phone-only field totals");
    expect(workspace).toContain("Partial field totals");
    expect(workspace).toContain("min-[480px]:flex-row");
    expect(workspace).toContain("&lead=${encodeURIComponent(lead.id)}");
    expect(workspace).toContain("Pitch this homeowner");
  });

  it("only exposes native contact actions when the relevant consent is opted in", () => {
    expect(workspace).toContain(
      'phone.length > 0 && lead.smsConsentStatus === "opted_in"',
    );
    expect(workspace).toContain(
      'lead.emailConsentStatus === "opted_in"',
    );
    expect(workspace).toContain('href={`tel:${phone}`}');
    expect(workspace).toContain('href={`sms:${phone}`}');
    expect(workspace).toContain(
      'href={`mailto:${encodeURIComponent(lead.email ?? "")}`}',
    );
  });

  it("turns each homeowner card into an owned next-action workflow", () => {
    expect(workspace).toContain('kind: "update_lead"');
    expect(workspace).toContain("Update next move");
    expect(workspace).toContain("Save next move");
    expect(workspace).toContain("Estimated annual value");
    expect(workspace).toContain("Customer considering");
    expect(workspace).toContain("Latest context");
    expect(workspace).toContain('leadActionDraft.status === "follow_up"');
  });
});
