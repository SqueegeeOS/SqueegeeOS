import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workspace = readFileSync(
  new URL("../../components/sales/sales-rep-workspace.tsx", import.meta.url),
  "utf8",
);
const doorMemory = readFileSync(
  new URL("../../components/sales/door-memory.tsx", import.meta.url),
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
    expect(workspace).toContain('fetch("/api/presentations"');
    expect(workspace).toContain("Build their plan");
    expect(workspace).toContain("Save & build plan");
  });

  it("captures address outcomes without contacting or charging a homeowner", () => {
    expect(workspace).toContain('kind: "door_memory"');
    expect(workspace).toContain("doorActivityClientEventId");
    expect(workspace).toContain("activityStillQueued");
    expect(workspace).toContain("openHomeownerFromDoor");
    expect(workspace).toContain("doorMemoryClientEventId");
    expect(doorMemory).toContain("What happened here?");
    expect(doorMemory).toContain('priorAtAddress.disposition === "do_not_knock"');
    expect(doorMemory).toContain("Prior address history");
    expect(doorMemory).toContain("This does not text, email, enroll, or charge");
    expect(doorMemory).toContain("Checking saved address history");
  });

  it("turns one conversational door result into one field talk", () => {
    expect(workspace).toContain("salesDoorDispositionCountsConversation");
    expect(workspace).toContain("totals.conversationsToday += 1");
    expect(workspace).toContain('label: "Extra talk"');
    expect(workspace).toContain('detail: "No saved door"');
    expect(workspace).toContain("counts the talk automatically");
    expect(doorMemory).toContain(
      "This outcome counts one conversation automatically.",
    );
  });

  it("preserves activity-before-memory ordering in the offline field queue", () => {
    expect(workspace).toContain('kind: "activity"');
    expect(workspace).toContain('candidate.kind === "door_memory"');
    expect(workspace).toContain(
      'queued.kind === "activity"',
    );
    expect(workspace).toContain(
      "entry.doorActivityClientEventId === target.clientEventId",
    );
    expect(workspace).toContain("safe idempotent retry");
  });

  it("allows phone calls while keeping texts and emails consent-gated", () => {
    expect(workspace).toContain(
      "const canCall = phone.length > 0",
    );
    expect(workspace).toContain(
      'canCall && lead.smsConsentStatus === "opted_in"',
    );
    expect(workspace).toContain(
      'lead.emailConsentStatus === "opted_in"',
    );
    expect(workspace).toContain('href={`tel:${phone}`}');
    expect(workspace).toContain('href={`sms:${phone}`}');
    expect(workspace).toContain(
      'href={`mailto:${encodeURIComponent(lead.email ?? "")}`}',
    );
    expect(workspace).toContain("Call {canCall ? \"ready\" : \"unavailable\"}");
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

  it("keeps the loaded open queue discoverable and visibly prioritized", () => {
    expect(workspace).toContain("buildSalesLeadActionQueue");
    expect(workspace).toContain("Nothing overdue");
    expect(workspace).toContain("need a next move");
    expect(workspace).toContain("NEXT_ACTION_STYLES");
    expect(workspace).toContain("visibleLeadActionQueue.map");
    expect(workspace).toContain("Show highest-priority 8");
    expect(workspace).toContain("Show all ${leadActionQueue.length} open people");
    expect(workspace).toContain("[content-visibility:auto]");
    expect(workspace).toContain("setActionClock(Date.now())");
  });

  it("shows signed-to-scheduled handoff proof without exposing payment identifiers", () => {
    expect(workspace).toContain("Production handoff");
    expect(workspace).toContain("handoff.completedSteps");
    expect(workspace).toContain("handoff.nextScheduledAt");
    expect(workspace).toContain("handoff.actionHref");
    expect(workspace).toContain("Production handoff unverified");
    expect(workspace).not.toContain("stripe_payment_method_id");
    expect(workspace).not.toContain("stripe_customer_id");
  });
});
