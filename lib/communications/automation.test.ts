import { describe, expect, it } from "vitest";
import {
  buildAppointmentReminderIdempotencyKey,
  buildLeadAcknowledgementEmailPlan,
  buildLeadAcknowledgementIdempotencyKey,
  buildLeadFirstTouchSmsIdempotencyKey,
  buildLeadFirstTouchSmsPlan,
  buildReviewRequestIdempotencyKey,
  buildReviewRequestSmsPlan,
  buildVerifiedAppointmentReminderPlan,
  calculateQuietHoursDeliveryAt,
  hasActiveSmsConsent,
  normalizeContactPreference,
  type AppointmentReminderInput,
} from "./automation";

const CONSENT = {
  consented: true,
  consentedAt: "2026-07-01T18:00:00.000Z",
  optedOutAt: null,
} as const;

function verifiedAppointment(
  overrides: Partial<AppointmentReminderInput> = {},
): AppointmentReminderInput {
  return {
    externalAppointmentId: "jobber-visit-42",
    customerName: "Morgan Example",
    serviceLabel: "Exterior window cleaning",
    serviceAddress: "123 Main St",
    scheduledAt: "2026-07-12T17:00:00.000Z",
    status: "scheduled",
    verificationState: "verified",
    matchState: "matched",
    now: "2026-07-10T16:00:00.000Z",
    preferredChannel: "email",
    email: "morgan@example.com",
    phone: "+15555550123",
    smsConsent: CONSENT,
    ...overrides,
  };
}

describe("communications automation", () => {
  describe("deterministic idempotency keys", () => {
    it("builds stable lead keys", () => {
      expect(buildLeadAcknowledgementIdempotencyKey("lead / 42")).toBe(
        "lead:lead%20%2F%2042:acknowledgement:email:v1",
      );
      expect(buildLeadFirstTouchSmsIdempotencyKey("lead / 42")).toBe(
        "lead:lead%20%2F%2042:first-touch:sms:v1",
      );
      expect(buildLeadAcknowledgementIdempotencyKey("   ")).toBeNull();
    });

    it("anchors appointment keys to external ID, scheduled time, and channel", () => {
      const original = buildAppointmentReminderIdempotencyKey({
        externalAppointmentId: "visit/42",
        scheduledAt: "2026-07-12T17:00:00.000Z",
        channel: "email",
      });
      expect(original).toBe(
        "appointment:visit%2F42:2026-07-12T17%3A00%3A00.000Z:reminder-24h:email:v1",
      );
      expect(
        buildAppointmentReminderIdempotencyKey({
          externalAppointmentId: "visit/42",
          scheduledAt: "2026-07-12T17:00:00.000Z",
          channel: "email",
        }),
      ).toBe(original);
      expect(
        buildAppointmentReminderIdempotencyKey({
          externalAppointmentId: "visit/42",
          scheduledAt: "2026-07-12T18:00:00.000Z",
          channel: "email",
        }),
      ).not.toBe(original);
      expect(
        buildAppointmentReminderIdempotencyKey({
          externalAppointmentId: "visit/42",
          scheduledAt: "2026-07-12T17:00:00.000Z",
          channel: "sms",
        }),
      ).not.toBe(original);
    });

    it("builds one stable review-request key per completed appointment", () => {
      expect(buildReviewRequestIdempotencyKey("visit/42")).toBe(
        "appointment:visit%2F42:review-request:sms:v1",
      );
      expect(buildReviewRequestIdempotencyKey(" ")).toBeNull();
    });
  });

  describe("quiet hours", () => {
    it("defers a PDT evening request until 8am Pacific", () => {
      expect(
        calculateQuietHoursDeliveryAt("2026-07-10T03:30:00.000Z"),
      ).toBe("2026-07-10T15:00:00.000Z");
    });

    it("defers a PST early-morning request until 8am Pacific", () => {
      expect(
        calculateQuietHoursDeliveryAt("2026-01-10T15:30:00.000Z"),
      ).toBe("2026-01-10T16:00:00.000Z");
    });

    it("allows the exact end boundary and supports a disabled window", () => {
      expect(
        calculateQuietHoursDeliveryAt("2026-07-10T15:00:00.000Z"),
      ).toBe("2026-07-10T15:00:00.000Z");
      expect(
        calculateQuietHoursDeliveryAt("2026-07-10T03:30:00.000Z", {
          startHour: 8,
          endHour: 8,
          timeZone: "America/Los_Angeles",
        }),
      ).toBe("2026-07-10T03:30:00.000Z");
    });

    it("rejects invalid dates, hours, and time zones", () => {
      expect(calculateQuietHoursDeliveryAt("not-a-date")).toBeNull();
      expect(
        calculateQuietHoursDeliveryAt("2026-07-10T03:30:00.000Z", {
          startHour: 24,
          endHour: 8,
          timeZone: "America/Los_Angeles",
        }),
      ).toBeNull();
      expect(
        calculateQuietHoursDeliveryAt("2026-07-10T03:30:00.000Z", {
          startHour: 20,
          endHour: 8,
          timeZone: "Not/A_Timezone",
        }),
      ).toBeNull();
    });
  });

  describe("lead acknowledgement email", () => {
    it("creates an escaped, plan-only receipt grounded in the supplied lead", () => {
      const plan = buildLeadAcknowledgementEmailPlan({
        leadId: "lead-123",
        customerName: '<script>alert("x")</script> Morgan',
        email: "morgan@example.com",
        services: ["Windows & Gutters", "Windows & Gutters", ""],
        requestedAt: "2026-07-10T18:30:00.000Z",
      });

      expect(plan).toMatchObject({
        mode: "plan_only",
        kind: "lead_acknowledgement",
        channel: "email",
        recipient: "morgan@example.com",
        idempotencyKey: "lead:lead-123:acknowledgement:email:v1",
        notBefore: "2026-07-10T18:30:00.000Z",
        subject: "We received your SqueegeeKing request",
      });
      expect(plan?.text).toContain("Windows & Gutters");
      expect(plan?.html).toContain("&lt;script&gt;");
      expect(plan?.html).toContain("Windows &amp; Gutters");
      expect(plan?.html).not.toContain("<script>");
    });

    it("rejects a missing destination or invalid request time", () => {
      expect(
        buildLeadAcknowledgementEmailPlan({
          leadId: "lead-123",
          customerName: "Morgan",
          email: " ",
          services: [],
          requestedAt: "2026-07-10T18:30:00.000Z",
        }),
      ).toBeNull();
      expect(
        buildLeadAcknowledgementEmailPlan({
          leadId: "lead-123",
          customerName: "Morgan",
          email: "morgan@example.com",
          services: [],
          requestedAt: "invalid",
        }),
      ).toBeNull();
    });
  });

describe("lead first-touch SMS", () => {
    it("requires explicit active consent and an SMS-compatible preference", () => {
      const base = {
        leadId: "lead-123",
        customerName: "Morgan",
        phone: "+15555550123",
        services: ["Window cleaning"],
        requestedAt: "2026-07-10T18:30:00.000Z",
        preferredChannel: "Text" as const,
        smsConsent: CONSENT,
      };

      expect(buildLeadFirstTouchSmsPlan(base)?.channel).toBe("sms");
      expect(
        buildLeadFirstTouchSmsPlan({
          ...base,
          preferredChannel: "email",
        }),
      ).toBeNull();
      expect(
        buildLeadFirstTouchSmsPlan({
          ...base,
          smsConsent: { consented: false, consentedAt: null },
        }),
      ).toBeNull();
      expect(
        buildLeadFirstTouchSmsPlan({
          ...base,
          smsConsent: {
            ...CONSENT,
            optedOutAt: "2026-07-10T18:00:00.000Z",
          },
        }),
      ).toBeNull();
    });

    it("produces only a fixed, consent-safe plan with opt-out language", () => {
      const plan = buildLeadFirstTouchSmsPlan({
        leadId: "lead-123",
        customerName: "Morgan\nInjected",
        phone: "+15555550123",
        services: ["Window cleaning\nTomorrow at 9"],
        requestedAt: "2026-07-10T18:30:00.000Z",
        preferredChannel: "either",
        smsConsent: CONSENT,
      });

      expect(plan).toMatchObject({
        mode: "plan_only",
        kind: "lead_first_touch",
        channel: "sms",
        idempotencyKey: "lead:lead-123:first-touch:sms:v1",
        subject: null,
        html: null,
      });
      expect(plan?.text).toContain("Reply STOP to opt out.");
      expect(plan?.text).not.toContain("\n");
    });

    it("uses the approved team welcome for an opted-in Facebook lead", () => {
      const plan = buildLeadFirstTouchSmsPlan({
        leadId: "facebook-lead-123",
        customerName: "Morgan Lee",
        phone: "+15555550123",
        services: [],
        requestedAt: "2026-07-10T18:30:00.000Z",
        preferredChannel: "Text",
        smsConsent: CONSENT,
        source: "facebook_lead_ad",
      });

      expect(plan?.text).toContain("about home care");
      expect(plan?.text).toContain("Our team received your request");
      expect(plan?.text).toContain("reply here with questions or scheduling details");
      expect(plan?.text).not.toContain("Donovan");
      expect(plan?.text).not.toContain("â");
      expect(plan?.text).toContain("Reply STOP to opt out.");
    });

    it("normalizes public form preferences and validates consent timestamps", () => {
      expect(normalizeContactPreference("Text")).toBe("sms");
      expect(normalizeContactPreference("Phone")).toBe("phone");
      expect(hasActiveSmsConsent(CONSENT)).toBe(true);
      expect(
        hasActiveSmsConsent({ consented: true, consentedAt: "invalid" }),
      ).toBe(false);
      expect(hasActiveSmsConsent(null)).toBe(false);
    });
  });

  describe("verified 24-hour appointment reminders", () => {
    it("plans an email exactly 24 hours before a verified matched visit", () => {
      const plan = buildVerifiedAppointmentReminderPlan(
        verifiedAppointment({
          customerName: "Morgan <Admin>",
          serviceLabel: "Windows & screens",
          serviceAddress: '123 <Main> & "A"',
        }),
      );

      expect(plan).toMatchObject({
        mode: "plan_only",
        kind: "appointment_reminder_24h",
        channel: "email",
        recipient: "morgan@example.com",
        notBefore: "2026-07-11T17:00:00.000Z",
      });
      expect(plan?.idempotencyKey).toContain(
        "jobber-visit-42:2026-07-12T17%3A00%3A00.000Z",
      );
      expect(plan?.html).toContain("Morgan");
      expect(plan?.html).toContain("Windows &amp; screens");
      expect(plan?.html).toContain(
        "123 &lt;Main&gt; &amp; &quot;A&quot;",
      );
      expect(plan?.html).not.toContain("123 <Main>");
    });

    it("honors channel preference, consent, and email fallback", () => {
      const sms = buildVerifiedAppointmentReminderPlan(
        verifiedAppointment({ preferredChannel: "either" }),
      );
      expect(sms?.channel).toBe("sms");
      expect(sms?.text).toContain("Reply STOP to opt out.");

      const emailFallback = buildVerifiedAppointmentReminderPlan(
        verifiedAppointment({
          preferredChannel: "either",
          smsConsent: { consented: false, consentedAt: null },
        }),
      );
      expect(emailFallback?.channel).toBe("email");

      expect(
        buildVerifiedAppointmentReminderPlan(
          verifiedAppointment({
            preferredChannel: "sms",
            smsConsent: { consented: false, consentedAt: null },
          }),
        ),
      ).toBeNull();
      expect(
        buildVerifiedAppointmentReminderPlan(
          verifiedAppointment({ preferredChannel: "phone" }),
        ),
      ).toBeNull();
    });

    it.each([
      { status: "cancelled" },
      { status: "completed" },
      { verificationState: "unverified" },
      { matchState: "unmatched" },
      { scheduledAt: "2026-07-10T15:00:00.000Z" },
    ])("suppresses unsafe appointment state %#", (overrides) => {
      expect(
        buildVerifiedAppointmentReminderPlan(
          verifiedAppointment(overrides as Partial<AppointmentReminderInput>),
        ),
      ).toBeNull();
    });

    it("changes the key after rescheduling and suppresses cancellation", () => {
      const original = buildVerifiedAppointmentReminderPlan(
        verifiedAppointment(),
      );
      const rescheduled = buildVerifiedAppointmentReminderPlan(
        verifiedAppointment({ scheduledAt: "2026-07-12T18:00:00.000Z" }),
      );
      const cancelled = buildVerifiedAppointmentReminderPlan(
        verifiedAppointment({ status: "cancelled" }),
      );

      expect(rescheduled?.idempotencyKey).not.toBe(original?.idempotencyKey);
      expect(cancelled).toBeNull();
    });

    it("suppresses a late reminder when quiet hours end after the visit", () => {
      expect(
        buildVerifiedAppointmentReminderPlan(
          verifiedAppointment({
            scheduledAt: "2026-07-11T15:00:00.000Z",
            now: "2026-07-11T14:30:00.000Z",
          }),
        ),
      ).toBeNull();
    });
  });

  describe("completed-visit review requests", () => {
    const base = {
      appointmentId: "visit-42",
      customerName: "Morgan Example",
      phone: "+15555550123",
      serviceLabel: "Exterior window cleaning",
      completedAt: "2026-07-10T17:00:00.000Z",
      now: "2026-07-12T18:00:00.000Z",
      reviewUrl:
        "https://search.google.com/local/writereview?placeid=ChIJexample",
      smsConsent: CONSENT,
    };

    it("creates a single honest-feedback plan with customer-care and opt-out copy", () => {
      const plan = buildReviewRequestSmsPlan(base);
      expect(plan).toMatchObject({
        mode: "plan_only",
        kind: "review_request_after_visit",
        channel: "sms",
        idempotencyKey: "appointment:visit-42:review-request:sms:v1",
      });
      expect(plan?.text).toContain("honest Google review");
      expect(plan?.text).toContain("If anything needs attention, reply here");
      expect(plan?.text).toContain("Reply STOP to opt out.");
      expect(plan?.text.toLowerCase()).not.toContain("five-star");
    });

    it("fails closed without active consent or a safe Google destination", () => {
      expect(
        buildReviewRequestSmsPlan({
          ...base,
          smsConsent: { consented: false, consentedAt: null },
        }),
      ).toBeNull();
      expect(
        buildReviewRequestSmsPlan({
          ...base,
          reviewUrl: "https://example.com/not-google",
        }),
      ).toBeNull();
    });

    it("waits at least 24 hours and respects quiet hours", () => {
      const early = buildReviewRequestSmsPlan({
        ...base,
        completedAt: "2026-07-12T17:00:00.000Z",
        now: "2026-07-12T18:00:00.000Z",
      });
      expect(early?.notBefore).toBe("2026-07-13T17:00:00.000Z");

      const evening = buildReviewRequestSmsPlan({
        ...base,
        completedAt: "2026-07-09T17:00:00.000Z",
        now: "2026-07-13T04:00:00.000Z",
      });
      expect(evening?.notBefore).toBe("2026-07-13T15:00:00.000Z");
    });
  });
});
