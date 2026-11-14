import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), ensure: vi.fn(), context: vi.fn(), send: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/persistence/supabase/client", () => ({ createServiceRoleSupabaseClient: () => ({ from: mocks.from }) }));
vi.mock("@/lib/communications/repository", () => ({ ensureHomeownerConversation: mocks.ensure, loadCommunicationConversationContext: mocks.context }));
vi.mock("@/lib/communications/service", () => ({ sendOutboundCommunication: mocks.send }));

import { processVerifiedAppointmentReminders } from "./reminders";
import { buildAppointmentReminderIdempotencyKey } from "./automation";

const appointment = {
  id: "appointment1", member_profile_id: "profile1", property_id: "property1",
  external_id: "jobber1", service_type: "gutter_cleaning", scheduled_at: "2026-11-20T20:00:00.000Z",
  status: "scheduled", verification_state: "verified", match_state: "matched",
};
let preferences: { homeowner_id: string; offset_minutes: number[]; updated_at: string }[];
let latest: typeof appointment | null;
let latestError: { message: string } | null;
let rereads: number;

beforeEach(() => {
  vi.clearAllMocks();
  preferences = [];
  latest = { ...appointment };
  latestError = null;
  rereads = 0;
  mocks.ensure.mockResolvedValue({ id: "conversation1" });
  mocks.context.mockResolvedValue({ customerName: "Synthetic", sms: {
    address: "+12025550100", verificationStatus: "verified", consentStatus: "opted_in",
  } });
  mocks.send.mockResolvedValue({ duplicate: false });
  mocks.from.mockImplementation((table: string) => {
    const data: unknown = ({
      customer_communication_automation_rules: [{ id: "rule1", channel: "sms", enabled: true, consent_required: true, verified_contact_required: true }],
      member_appointments: [appointment], member_profiles: [{ id: "profile1", homeowner_id: "homeowner1" }],
      properties: [{ id: "property1", address: "Synthetic address" }],
      customer_visit_reminder_preferences: preferences,
    } as Record<string, unknown>)[table];
    if (!data) throw new Error(`Unexpected table: ${table}`);
    const result = Promise.resolve({ data, error: null });
    const query = {
      select: () => query, eq: () => query, in: () => query, gte: () => query,
      lte: () => query, order: () => query, then: result.then.bind(result),
      maybeSingle: async () => { rereads++; return { data: latest, error: latestError }; },
    };
    return query;
  });
});

function setOffsets(offset_minutes: number[], updated_at = "2026-11-01T20:00:00.000Z") {
  preferences = [{ homeowner_id: "homeowner1", offset_minutes, updated_at }];
}
const dayDue = new Date("2026-11-19T20:05:00.000Z");

describe("verified appointment reminder execution", () => {
  it.each(["cancelled", "rescheduled", "missing", "unverified", "unmatched", "read-error"])("fails closed on %s at immediate schedule reread", async (scenario) => {
    if (scenario === "cancelled") latest!.status = "cancelled";
    if (scenario === "rescheduled") latest!.scheduled_at = "2026-11-21T20:00:00.000Z";
    if (scenario === "missing") latest = null;
    if (scenario === "unverified") latest!.verification_state = "unverified";
    if (scenario === "unmatched") latest!.match_state = "unmatched";
    if (scenario === "read-error") latestError = { message: "unavailable" };
    expect(await processVerifiedAppointmentReminders(dayDue)).toMatchObject({ sent: 0, skipped: 1, failed: 0 });
    expect(rereads).toBe(1);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("off preference sends nothing", async () => {
    setOffsets([]);
    expect(await processVerifiedAppointmentReminders(dayDue)).toMatchObject({ sent: 0, failed: 0 });
    expect(mocks.send).not.toHaveBeenCalled();
    expect(rereads).toBe(0);
    expect(mocks.ensure).not.toHaveBeenCalled();
  });

  it("newly saved preferences do not backfill an already-passed reminder", async () => {
    setOffsets([1440], "2026-11-19T20:01:00.000Z");
    expect(await processVerifiedAppointmentReminders(dayDue)).toMatchObject({ sent: 0, skipped: 1 });
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.ensure).not.toHaveBeenCalled();
  });

  it.each([
    ["2026-11-13T20:05:00.000Z", 10080],
    ["2026-11-19T20:05:00.000Z", 1440],
  ])("both day/week only sends due offset at %s", async (now, offset) => {
    setOffsets([10080, 1440]);
    expect(await processVerifiedAppointmentReminders(new Date(now))).toMatchObject({ sent: 1, skipped: 0 });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.send.mock.calls[0][0].metadata.reminderOffsetMinutes).toBe(offset);
  });

  it("custom offsets send only when due", async () => {
    setOffsets([180, 60]);
    expect(await processVerifiedAppointmentReminders(new Date("2026-11-20T17:05:00.000Z"))).toMatchObject({ sent: 1, skipped: 0 });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.send.mock.calls[0][0].metadata.reminderOffsetMinutes).toBe(180);
  });

  it("missing preferences retain the default day reminder and original idempotency key", async () => {
    expect(await processVerifiedAppointmentReminders(dayDue)).toMatchObject({ candidates: 1, sent: 1 });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.send.mock.calls[0][0]).toMatchObject({
      idempotencyKey: buildAppointmentReminderIdempotencyKey({ externalAppointmentId: appointment.external_id, scheduledAt: appointment.scheduled_at, channel: "sms" }),
      metadata: { reminderOffsetMinutes: 1440 },
    });
    mocks.send.mockResolvedValue({ duplicate: true });
    expect(await processVerifiedAppointmentReminders(dayDue)).toMatchObject({ sent: 0, duplicate: 1 });
    expect(mocks.send.mock.calls[1][0].idempotencyKey).toBe(mocks.send.mock.calls[0][0].idempotencyKey);
  });
});
