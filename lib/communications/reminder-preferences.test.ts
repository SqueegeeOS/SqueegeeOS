import { describe, it, expect } from "vitest";
import { parseReminderOffsets, reminderIsDue } from "./reminder-preferences";
import { buildAppointmentReminderIdempotencyKey, calculateQuietHoursDeliveryAt, buildVerifiedAppointmentReminderPlan } from "./automation";
describe("account reminder timing", () => {
  it("supports day, week, both, custom and off without duplicating", () => {
    expect(parseReminderOffsets([1440,10080,1440])).toEqual([10080,1440]);
    expect(parseReminderOffsets([])).toEqual([]);
    expect(parseReminderOffsets([90])).toEqual([90]);
    for (const value of [null,[0],[-1],[60.1],[43201], [60,120,180,240,300], ["1440"]]) expect(() => parseReminderOffsets(value)).toThrow();
  });
  it("keeps existing 24-hour idempotency and separates custom offsets and reschedules", () => {
    const input = { externalAppointmentId: "job1", scheduledAt: "2026-11-20T20:00:00Z", channel: "sms" as const };
    expect(buildAppointmentReminderIdempotencyKey(input)).toBe(buildAppointmentReminderIdempotencyKey({...input,offsetMinutes:1440}));
    expect(buildAppointmentReminderIdempotencyKey(input)).not.toBe(buildAppointmentReminderIdempotencyKey({...input,offsetMinutes:10080}));
    expect(buildAppointmentReminderIdempotencyKey(input)).not.toBe(buildAppointmentReminderIdempotencyKey({...input,scheduledAt:"2026-11-21T20:00:00Z"}));
  });
  it("does not miss a visit 25 hours away on a frequent schedule or send early", () => {
    const input = { dueAt: "2026-11-19T20:00:00Z", scheduledAt: "2026-11-20T20:00:00Z" };
    expect(reminderIsDue({...input,now:new Date("2026-11-19T19:00:00Z")})).toBe(false);
    expect(reminderIsDue({...input,now:new Date("2026-11-19T20:05:00Z")})).toBe(true);
    expect(reminderIsDue({...input,now:new Date("2026-11-20T19:00:00Z")})).toBe(true);
    expect(reminderIsDue({...input,now:new Date("2026-11-19T20:05:00Z"),preferencesUpdatedAt:"2026-11-19T20:01:00Z"})).toBe(false);
  });
  it("moves quiet-time reminders to morning and still excludes started visits", () => {
    const dueAt = calculateQuietHoursDeliveryAt("2026-11-19T05:00:00Z");
    expect(dueAt).toBe("2026-11-19T16:00:00.000Z");
    expect(reminderIsDue({dueAt,scheduledAt:"2026-11-20T05:00:00Z",now:new Date("2026-11-19T16:05:00Z")})).toBe(true);
    expect(reminderIsDue({dueAt,scheduledAt:"2026-11-19T15:00:00Z",now:new Date("2026-11-19T16:05:00Z")})).toBe(false);
  });
  it("requires current verified schedule and explicit SMS consent for every offset", () => {
    const input = {externalAppointmentId:"job1",customerName:"Test",serviceLabel:"windows",scheduledAt:"2026-11-20T20:00:00Z",now:"2026-11-13T20:00:00Z",status:"scheduled",verificationState:"verified",matchState:"matched",preferredChannel:"sms" as const,phone:"+15555555555",smsConsent:{consented:true,consentedAt:"2026-11-01T00:00:00Z"},offsetMinutes:10080};
    expect(buildVerifiedAppointmentReminderPlan(input)?.notBefore).toBe("2026-11-13T20:00:00.000Z");
    expect(buildVerifiedAppointmentReminderPlan({...input,status:"cancelled"})).toBeNull();
    expect(buildVerifiedAppointmentReminderPlan({...input,smsConsent:{consented:false,consentedAt:null}})).toBeNull();
  });
});
