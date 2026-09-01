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
const firstMission = readFileSync(
  new URL("../../components/sales/first-field-mission.tsx", import.meta.url),
  "utf8",
);
const leadInteractionControl = readFileSync(
  new URL(
    "../../components/sales/lead-interaction-control.tsx",
    import.meta.url,
  ),
  "utf8",
);
const fieldNextMove = readFileSync(
  new URL("../../components/sales/field-next-move.tsx", import.meta.url),
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

  it("keeps an interrupted homeowner capture on-device and retry-safe", () => {
    expect(workspace).toContain("recoverLeadCaptureDraft");
    expect(workspace).toContain("serializeSalesLeadCaptureDraft");
    expect(workspace).toContain("window.crypto.randomUUID()");
    expect(workspace).toContain("Field-safe draft");
    expect(workspace).toContain("up to 24 hours");
    expect(workspace).toContain("HomeAtlas will not create a duplicate");
    expect(workspace).toContain("Keep &amp; close");
    expect(workspace).toContain("Discard draft");
  });

  it("guides an installed rep through one evidence-backed revenue loop", () => {
    expect(workspace).toContain("deriveSalesRepLaunchReadiness");
    expect(workspace).toContain('phonePass: "installed"');
    expect(workspace).toContain('sessionKind === "sales_rep"');
    expect(workspace).toContain("FirstFieldMission");
    expect(firstMission).toContain("One real homeowner, all the way through.");
    expect(firstMission).toContain("never from a practice tap");
    expect(firstMission).toContain("No message or payment happens");
    expect(firstMission).toContain("Capture first homeowner");
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
    expect(workspace).toContain('label: "Homeowner talked to"');
    expect(workspace).toContain('detail: "Log real conversation"');
    expect(workspace).toContain("counts the homeowner conversation automatically");
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

  it("records durable outcomes without pretending to send communication", () => {
    expect(workspace).toContain('kind: "lead_interaction"');
    expect(workspace).toContain("LeadInteractionControl");
    expect(leadInteractionControl).toContain("Record outcome");
    expect(leadInteractionControl).toContain("No answer");
    expect(leadInteractionControl).toContain("Presentation set");
    expect(leadInteractionControl).toContain("Show history");
    expect(leadInteractionControl).toContain(
      "Recording below never sends, schedules, enrolls, invoices, or charges.",
    );
    expect(leadInteractionControl.toLowerCase()).not.toContain("twilio");
    expect(leadInteractionControl.toLowerCase()).not.toContain("resend");
    expect(leadInteractionControl.toLowerCase()).not.toContain("stripe");
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
    expect(workspace).toContain("salesRepLeadIdFromHash");
    expect(workspace).toContain("salesRepLeadAnchorId(lead.id)");
    expect(workspace).toContain("target.scrollIntoView");
    expect(workspace).toContain("linkedLeadAction");
  });

  it("pulls newly assigned work onto an open field phone without background churn", () => {
    expect(workspace).toContain("workspaceRefreshPromiseRef");
    expect(workspace).toContain("workspaceRefreshRequestRef");
    expect(workspace).toContain(
      "completedRequest < workspaceRefreshRequestRef.current",
    );
    expect(workspace).toContain("shouldAutoRefreshFieldWorkspace");
    expect(workspace).toContain("FIELD_WORKSPACE_REFRESH_INTERVAL_MS");
    expect(workspace).toContain('window.addEventListener("focus", refreshWhenVisible)');
    expect(workspace).toContain(
      'document.addEventListener("visibilitychange", refreshWhenVisible)',
    );
    expect(workspace).toContain("offlineQueueRef.current.length > 0");
    expect(workspace).toContain("workspaceSyncStatus");
    expect(workspace).toContain("Refresh the field desk");
  });

  it("surfaces one urgent next move without sending on the rep's behalf", () => {
    expect(workspace).toContain("selectFieldNextMove");
    expect(workspace).toContain("<FieldNextMove");
    expect(fieldNextMove).toContain("Do this first · overdue");
    expect(fieldNextMove).toContain("Choose the next move");
    expect(fieldNextMove).toContain('href={`tel:${phone}`}');
    expect(fieldNextMove).toContain('href={`sms:${phone}`}');
    expect(fieldNextMove).toContain("never sends by itself");
    expect(fieldNextMove.toLowerCase()).not.toContain("twilio");
    expect(fieldNextMove.toLowerCase()).not.toContain("resend");
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

  it("revalidates an accepted Stripe handoff without sending or charging", () => {
    expect(workspace).toContain("usePaymentHandoffRefresh");
    expect(workspace).toContain('stage === "payment_pending"');
    expect(workspace).toContain("Check Stripe now");
    expect(workspace).toContain("Stripe confirmed · card on file");
  });
});
