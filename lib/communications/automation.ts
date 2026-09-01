import {
  COMPANY_BUSINESS_TIMEZONE,
  formatBusinessCalendarDate,
  zonedDateTimeToUtc,
} from "@/lib/admin/company-business-timezone";

export type CommunicationChannel = "email" | "sms";

export type ContactPreference =
  | "email"
  | "sms"
  | "phone"
  | "either"
  | "none";

export type ContactPreferenceInput =
  | ContactPreference
  | "Email"
  | "Text"
  | "Phone";

export interface SmsConsent {
  consented: boolean;
  consentedAt: string | null;
  optedOutAt?: string | null;
}

export interface QuietHours {
  startHour: number;
  endHour: number;
  timeZone: string;
}

export const DEFAULT_QUIET_HOURS: QuietHours = {
  startHour: 20,
  endHour: 8,
  timeZone: COMPANY_BUSINESS_TIMEZONE,
};

export type CommunicationAutomationKind =
  | "lead_acknowledgement"
  | "lead_first_touch"
  | "appointment_reminder_24h"
  | "review_request_after_visit";

/**
 * A deterministic plan only. This module never contacts a provider and never
 * gives an AI model permission to send a customer message.
 */
export interface PlannedCommunication {
  mode: "plan_only";
  kind: CommunicationAutomationKind;
  channel: CommunicationChannel;
  recipient: string;
  idempotencyKey: string;
  notBefore: string;
  subject: string | null;
  text: string;
  html: string | null;
}

export interface LeadAcknowledgementInput {
  leadId: string;
  customerName: string;
  email: string;
  services: readonly string[];
  requestedAt: string | Date;
}

export interface LeadFirstTouchSmsInput {
  leadId: string;
  customerName: string;
  phone: string;
  services: readonly string[];
  requestedAt: string | Date;
  preferredChannel: ContactPreferenceInput;
  smsConsent: SmsConsent;
  quietHours?: QuietHours;
  source?: "request_form" | "facebook_lead_ad";
}

export interface AppointmentReminderInput {
  externalAppointmentId: string;
  customerName: string;
  serviceLabel: string;
  serviceAddress?: string | null;
  scheduledAt: string | Date;
  status: string;
  verificationState: string;
  matchState: string;
  now: string | Date;
  preferredChannel: ContactPreferenceInput;
  email?: string | null;
  phone?: string | null;
  smsConsent?: SmsConsent | null;
  quietHours?: QuietHours;
}

export interface ReviewRequestSmsInput {
  appointmentId: string;
  customerName: string;
  phone: string;
  serviceLabel: string;
  completedAt: string | Date;
  now: string | Date;
  reviewUrl: string;
  smsConsent: SmsConsent;
  quietHours?: QuietHours;
}

const LOCAL_CLOCK_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function localClockFormatter(timeZone: string): Intl.DateTimeFormat {
  const existing = LOCAL_CLOCK_FORMATTERS.get(timeZone);
  if (existing) return existing;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
  LOCAL_CLOCK_FORMATTERS.set(timeZone, formatter);
  return formatter;
}

function readPart(parts: Intl.DateTimeFormatPart[], type: string): number {
  return Number(parts.find((part) => part.type === type)?.value ?? 0);
}

function addCalendarDays(calendarDate: string, days: number): string {
  const [year, month, day] = calendarDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

function validDate(value: string | Date): Date | null {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function validHour(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 23;
}

/** Returns the requested instant or the first instant after local quiet hours. */
export function calculateQuietHoursDeliveryAt(
  requestedAt: string | Date,
  quietHours: QuietHours = DEFAULT_QUIET_HOURS,
): string | null {
  const instant = validDate(requestedAt);
  if (!instant) return null;
  if (
    !validHour(quietHours.startHour) ||
    !validHour(quietHours.endHour) ||
    !quietHours.timeZone.trim()
  ) {
    return null;
  }

  // Matching boundaries represent no configured quiet window.
  if (quietHours.startHour === quietHours.endHour) {
    return instant.toISOString();
  }

  try {
    const parts = localClockFormatter(quietHours.timeZone).formatToParts(instant);
    const localMinutes =
      readPart(parts, "hour") * 60 + readPart(parts, "minute");
    const startMinutes = quietHours.startHour * 60;
    const endMinutes = quietHours.endHour * 60;
    const crossesMidnight = startMinutes > endMinutes;
    const isQuiet = crossesMidnight
      ? localMinutes >= startMinutes || localMinutes < endMinutes
      : localMinutes >= startMinutes && localMinutes < endMinutes;

    if (!isQuiet) return instant.toISOString();

    const localDate = formatBusinessCalendarDate(instant, quietHours.timeZone);
    const deliveryDate =
      crossesMidnight && localMinutes >= startMinutes
        ? addCalendarDays(localDate, 1)
        : localDate;
    return zonedDateTimeToUtc(
      deliveryDate,
      quietHours.endHour,
      0,
      0,
      quietHours.timeZone,
    ).toISOString();
  } catch {
    return null;
  }
}

export function normalizeContactPreference(
  value: ContactPreferenceInput,
): ContactPreference {
  const normalized = value.trim().toLowerCase();
  if (normalized === "text" || normalized === "sms") return "sms";
  if (normalized === "email") return "email";
  if (normalized === "phone") return "phone";
  if (normalized === "either") return "either";
  return "none";
}

export function hasActiveSmsConsent(
  consent: SmsConsent | null | undefined,
): boolean {
  if (!consent?.consented || !validDate(consent.consentedAt ?? "")) return false;
  // Any recorded opt-out wins over an earlier or accidental consent flag.
  return !consent.optedOutAt?.trim();
}

function allowsSmsPreference(preference: ContactPreferenceInput): boolean {
  const normalized = normalizeContactPreference(preference);
  return normalized === "sms" || normalized === "either";
}

function cleanText(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

function firstName(value: string): string {
  return cleanText(value).split(" ")[0] || "there";
}

function serviceSummary(services: readonly string[]): string {
  const unique = [
    ...new Set(services.map(cleanText).filter((service) => service.length > 0)),
  ];
  return unique.length > 0 ? unique.join(", ") : "home care";
}

function keySegment(value: string): string | null {
  const normalized = cleanText(value);
  return normalized ? encodeURIComponent(normalized) : null;
}

export function buildLeadAcknowledgementIdempotencyKey(
  leadId: string,
): string | null {
  const id = keySegment(leadId);
  return id ? `lead:${id}:acknowledgement:email:v1` : null;
}

export function buildLeadFirstTouchSmsIdempotencyKey(
  leadId: string,
): string | null {
  const id = keySegment(leadId);
  return id ? `lead:${id}:first-touch:sms:v1` : null;
}

export function buildAppointmentReminderIdempotencyKey(input: {
  externalAppointmentId: string;
  scheduledAt: string | Date;
  channel: CommunicationChannel;
}): string | null {
  const externalId = keySegment(input.externalAppointmentId);
  const scheduledAt = validDate(input.scheduledAt);
  if (!externalId || !scheduledAt) return null;
  return `appointment:${externalId}:${encodeURIComponent(
    scheduledAt.toISOString(),
  )}:reminder-24h:${input.channel}:v1`;
}

export function buildReviewRequestIdempotencyKey(
  appointmentId: string,
): string | null {
  const id = keySegment(appointmentId);
  return id ? `appointment:${id}:review-request:sms:v1` : null;
}

export function buildLeadAcknowledgementEmailPlan(
  input: LeadAcknowledgementInput,
): PlannedCommunication | null {
  const recipient = input.email.trim();
  const requestedAt = validDate(input.requestedAt);
  const idempotencyKey = buildLeadAcknowledgementIdempotencyKey(input.leadId);
  if (!recipient || !requestedAt || !idempotencyKey) return null;

  const name = firstName(input.customerName);
  const services = serviceSummary(input.services);
  const text = `Hi ${name}, we received your SqueegeeKing request for ${services}. A person from our team will follow up soon.`;
  return {
    mode: "plan_only",
    kind: "lead_acknowledgement",
    channel: "email",
    recipient,
    idempotencyKey,
    notBefore: requestedAt.toISOString(),
    subject: "We received your SqueegeeKing request",
    text,
    html: `<p>Hi ${escapeHtml(name)},</p><p>We received your SqueegeeKing request for ${escapeHtml(
      services,
    )}. A person from our team will follow up soon.</p>`,
  };
}

export function buildLeadFirstTouchSmsPlan(
  input: LeadFirstTouchSmsInput,
): PlannedCommunication | null {
  const recipient = input.phone.trim();
  const idempotencyKey = buildLeadFirstTouchSmsIdempotencyKey(input.leadId);
  if (
    !recipient ||
    !idempotencyKey ||
    !allowsSmsPreference(input.preferredChannel) ||
    !hasActiveSmsConsent(input.smsConsent)
  ) {
    return null;
  }
  const notBefore = calculateQuietHoursDeliveryAt(
    input.requestedAt,
    input.quietHours,
  );
  if (!notBefore) return null;

  const name = firstName(input.customerName);
  const services = serviceSummary(input.services);
  const text =
    input.source === "facebook_lead_ad"
      ? `Hi ${name}, thanks for reaching out to SqueegeeKing about ${services}! Our team received your request and will personally follow up shortly. You can reply here with questions or scheduling details. Reply STOP to opt out.`
      : `Hi ${name}, this is SqueegeeKing. We received your request for ${services}. A person from our team will follow up soon. Reply STOP to opt out.`;
  return {
    mode: "plan_only",
    kind: "lead_first_touch",
    channel: "sms",
    recipient,
    idempotencyKey,
    notBefore,
    subject: null,
    text,
    html: null,
  };
}

function selectReminderChannel(
  input: AppointmentReminderInput,
): { channel: CommunicationChannel; recipient: string } | null {
  const preference = normalizeContactPreference(input.preferredChannel);
  const email = input.email?.trim() ?? "";
  const phone = input.phone?.trim() ?? "";
  const smsAllowed = Boolean(phone && hasActiveSmsConsent(input.smsConsent));

  if (preference === "email") {
    return email ? { channel: "email", recipient: email } : null;
  }
  if (preference === "sms") {
    return smsAllowed ? { channel: "sms", recipient: phone } : null;
  }
  if (preference === "either") {
    if (smsAllowed) return { channel: "sms", recipient: phone };
    return email ? { channel: "email", recipient: email } : null;
  }
  return null;
}

function formatAppointmentTime(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: COMPANY_BUSINESS_TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(value);
}

export function buildVerifiedAppointmentReminderPlan(
  input: AppointmentReminderInput,
): PlannedCommunication | null {
  const scheduledAt = validDate(input.scheduledAt);
  const now = validDate(input.now);
  if (
    !scheduledAt ||
    !now ||
    input.status.trim().toLowerCase() !== "scheduled" ||
    input.verificationState.trim().toLowerCase() !== "verified" ||
    input.matchState.trim().toLowerCase() !== "matched" ||
    scheduledAt.getTime() <= now.getTime()
  ) {
    return null;
  }

  const destination = selectReminderChannel(input);
  if (!destination) return null;
  const idempotencyKey = buildAppointmentReminderIdempotencyKey({
    externalAppointmentId: input.externalAppointmentId,
    scheduledAt,
    channel: destination.channel,
  });
  if (!idempotencyKey) return null;

  const reminderAt = new Date(scheduledAt.getTime() - 24 * 60 * 60 * 1_000);
  const requestedAt = new Date(Math.max(reminderAt.getTime(), now.getTime()));
  const notBefore = calculateQuietHoursDeliveryAt(
    requestedAt,
    input.quietHours,
  );
  if (!notBefore || new Date(notBefore).getTime() >= scheduledAt.getTime()) {
    return null;
  }

  const name = firstName(input.customerName);
  const service = cleanText(input.serviceLabel) || "service";
  const address = cleanText(input.serviceAddress ?? "");
  const appointmentTime = formatAppointmentTime(scheduledAt);
  const addressText = address ? ` Service address: ${address}.` : "";
  const optOutText =
    destination.channel === "sms" ? " Reply STOP to opt out." : "";
  const text = `Hi ${name}, reminder: your ${service} visit is scheduled for ${appointmentTime}.${addressText}${optOutText}`;
  const subject = `Reminder: ${service} visit`;

  return {
    mode: "plan_only",
    kind: "appointment_reminder_24h",
    channel: destination.channel,
    recipient: destination.recipient,
    idempotencyKey,
    notBefore,
    subject: destination.channel === "email" ? subject : null,
    text,
    html:
      destination.channel === "email"
        ? `<p>Hi ${escapeHtml(name)},</p><p>Reminder: your ${escapeHtml(
            service,
          )} visit is scheduled for ${escapeHtml(appointmentTime)}.${
            address ? ` Service address: ${escapeHtml(address)}.` : ""
          }</p>`
        : null,
  };
}

/**
 * Plans a single post-visit customer-care text. The caller still has to prove
 * that the visit is verified, that no service issue is open, and that Twilio
 * is approved before this plan can be delivered.
 */
export function buildReviewRequestSmsPlan(
  input: ReviewRequestSmsInput,
): PlannedCommunication | null {
  const recipient = input.phone.trim();
  const completedAt = validDate(input.completedAt);
  const now = validDate(input.now);
  const idempotencyKey = buildReviewRequestIdempotencyKey(input.appointmentId);
  let reviewUrl: URL;
  try {
    reviewUrl = new URL(input.reviewUrl);
  } catch {
    return null;
  }
  const host = reviewUrl.hostname.toLowerCase();
  const isGoogleDestination =
    reviewUrl.protocol === "https:" &&
    (host === "google.com" ||
      host.endsWith(".google.com") ||
      host === "g.page" ||
      host === "maps.app.goo.gl");
  if (
    !recipient ||
    !completedAt ||
    !now ||
    !idempotencyKey ||
    !hasActiveSmsConsent(input.smsConsent) ||
    !isGoogleDestination
  ) {
    return null;
  }

  const readyAt = new Date(
    Math.max(completedAt.getTime() + 24 * 60 * 60 * 1_000, now.getTime()),
  );
  const notBefore = calculateQuietHoursDeliveryAt(readyAt, input.quietHours);
  if (!notBefore) return null;

  const name = firstName(input.customerName);
  const service = cleanText(input.serviceLabel) || "recent service";
  const text = `Hi ${name}, this is SqueegeeKing. Thanks for trusting us with your ${service}. If you have a moment, we'd appreciate an honest Google review: ${reviewUrl.toString()} If anything needs attention, reply here and we'll make it right. Reply STOP to opt out.`;
  return {
    mode: "plan_only",
    kind: "review_request_after_visit",
    channel: "sms",
    recipient,
    idempotencyKey,
    notBefore,
    subject: null,
    text,
    html: null,
  };
}
