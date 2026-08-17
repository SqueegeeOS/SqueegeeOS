import {
  SALES_ACTIVITY_TYPES,
  SALES_LEAD_INTERACTION_CHANNELS,
  SALES_LEAD_INTERACTION_OUTCOMES,
  type CreateSalesLeadInput,
  type RecordSalesLeadInteractionInput,
  type SalesActivityType,
  type UpdateSalesLeadInput,
} from "./workspace-types";
import {
  SALES_DOOR_DISPOSITIONS,
  normalizeSalesDoorAddress,
  normalizeSalesDoorAddressKey,
  type SalesDoorDisposition,
} from "./door-memory";
import {
  isSalesServiceInterest,
  normalizeSalesServiceInterests,
  SALES_SERVICE_INTERESTS,
  type SalesServiceInterest,
} from "./service-interests";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_PATTERN = /^\+[1-9]\d{7,14}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const EDITABLE_LEAD_STATUSES = new Set<UpdateSalesLeadInput["status"]>([
  "new",
  "follow_up",
  "presentation",
  "considering",
  "lost",
]);

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function validateServiceInterests(
  value: unknown,
  allowMissing: boolean,
):
  | { ok: true; value: SalesServiceInterest[] | null }
  | { ok: false; error: string } {
  if (typeof value === "undefined" && allowMissing) {
    return { ok: true, value: null };
  }
  if (typeof value !== "undefined" && !Array.isArray(value)) {
    return { ok: false, error: "Choose valid services for this homeowner." };
  }
  const raw = Array.isArray(value) ? value : [];
  if (
    raw.length > SALES_SERVICE_INTERESTS.length ||
    raw.some((interest) => !isSalesServiceInterest(interest))
  ) {
    return { ok: false, error: "Choose valid services for this homeowner." };
  }
  return { ok: true, value: normalizeSalesServiceInterests(raw) };
}

export function normalizeNorthAmericanPhone(value: unknown): string | null {
  const raw = cleanText(value, 40);
  if (!raw) return null;
  if (E164_PATTERN.test(raw)) return raw;

  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function validateCreateSalesLead(input: unknown):
  | { ok: true; value: Required<Omit<CreateSalesLeadInput, "phone" | "email" | "nextFollowUpAt" | "notes" | "doorMemoryClientEventId">> & {
      phone: string | null;
      email: string | null;
      nextFollowUpAt: string | null;
      notes: string;
      doorMemoryClientEventId: string | null;
    } }
  | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Lead details are required." };
  }

  const raw = input as Record<string, unknown>;
  const clientEventId = cleanText(raw.clientEventId, 80);
  const fullName = cleanText(raw.fullName, 140);
  const propertyAddress = normalizeSalesDoorAddress(
    cleanText(raw.propertyAddress, 260),
  );
  const rawPhone = cleanText(raw.phone, 40);
  const phone = normalizeNorthAmericanPhone(rawPhone);
  const email = cleanText(raw.email, 320).toLowerCase() || null;
  const serviceInterests = validateServiceInterests(
    raw.serviceInterests,
    false,
  );
  const notes = cleanText(raw.notes, 2000);
  const smsConsentAttested = raw.smsConsentAttested === true;
  const emailConsentAttested = raw.emailConsentAttested === true;
  const doorMemoryClientEventId =
    cleanText(raw.doorMemoryClientEventId, 80) || null;

  if (fullName.length < 2) {
    return { ok: false, error: "Enter the homeowner's name." };
  }
  if (propertyAddress.length < 5) {
    return { ok: false, error: "Enter the property address." };
  }
  if (rawPhone && !phone) {
    return { ok: false, error: "Enter a valid US or E.164 phone number." };
  }
  if (email && !EMAIL_PATTERN.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!phone && !email) {
    return { ok: false, error: "Add a phone number or email address." };
  }
  if (!serviceInterests.ok) return serviceInterests;
  if (smsConsentAttested && !phone) {
    return { ok: false, error: "A phone number is required for text permission." };
  }
  if (emailConsentAttested && !email) {
    return { ok: false, error: "An email address is required for email permission." };
  }
  if (!UUID_PATTERN.test(clientEventId)) {
    return {
      ok: false,
      error: "This homeowner draft needs a fresh save reference. Close and reopen it.",
    };
  }
  if (
    doorMemoryClientEventId &&
    !UUID_PATTERN.test(doorMemoryClientEventId)
  ) {
    return { ok: false, error: "Door memory reference is invalid." };
  }
  if (doorMemoryClientEventId === clientEventId) {
    return {
      ok: false,
      error: "The homeowner save and doorstep entry need separate retry references.",
    };
  }

  const estimatedArrDollars = Number(raw.estimatedArrDollars ?? 0);
  if (!Number.isFinite(estimatedArrDollars) || estimatedArrDollars < 0 || estimatedArrDollars > 1_000_000) {
    return { ok: false, error: "Estimated ARR must be between $0 and $1,000,000." };
  }

  let nextFollowUpAt: string | null = null;
  if (raw.nextFollowUpAt) {
    const parsed = new Date(String(raw.nextFollowUpAt));
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: "Choose a valid follow-up time." };
    }
    nextFollowUpAt = parsed.toISOString();
  }

  return {
    ok: true,
    value: {
      clientEventId,
      fullName,
      propertyAddress,
      phone,
      email,
      serviceInterests: serviceInterests.value ?? ["exterior_windows"],
      estimatedArrDollars: Math.round(estimatedArrDollars * 100) / 100,
      nextFollowUpAt,
      notes,
      smsConsentAttested,
      emailConsentAttested,
      doorMemoryClientEventId,
    },
  };
}

export function validateCreateSalesActivity(input: unknown):
  | {
      ok: true;
      value: {
        activityType: SalesActivityType;
        quantity: number;
        leadId: string | null;
        clientEventId: string | null;
        occurredAt: string | null;
      };
    }
  | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Activity details are required." };
  }

  const raw = input as Record<string, unknown>;
  const activityType = cleanText(raw.activityType, 80) as SalesActivityType;
  if (!SALES_ACTIVITY_TYPES.includes(activityType)) {
    return { ok: false, error: "Choose a valid field activity." };
  }
  if (activityType === "membership_signed") {
    return {
      ok: false,
      error: "Signed memberships are recorded automatically from the agreement.",
    };
  }

  const quantity = Number(raw.quantity ?? 1);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
    return { ok: false, error: "Activity count must be between 1 and 100." };
  }

  const leadId = cleanText(raw.leadId, 80) || null;
  if (leadId && !UUID_PATTERN.test(leadId)) {
    return { ok: false, error: "Lead reference is invalid." };
  }

  const clientEventId = cleanText(raw.clientEventId, 80) || null;
  if (clientEventId && !UUID_PATTERN.test(clientEventId)) {
    return { ok: false, error: "Activity retry reference is invalid." };
  }

  let occurredAt: string | null = null;
  if (raw.occurredAt) {
    const parsed = new Date(String(raw.occurredAt));
    const now = Date.now();
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: "Activity time is invalid." };
    }
    if (parsed.getTime() < now - 24 * 60 * 60 * 1000) {
      return {
        ok: false,
        error: "Queued field activity must be less than 24 hours old.",
      };
    }
    if (parsed.getTime() > now + 60 * 1000) {
      return { ok: false, error: "Activity time cannot be in the future." };
    }
    occurredAt = parsed.toISOString();
  }

  return {
    ok: true,
    value: { activityType, quantity, leadId, clientEventId, occurredAt },
  };
}

export function validateCreateSalesDoorMemory(input: unknown):
  | {
      ok: true;
      value: {
        doorActivityClientEventId: string;
        clientEventId: string;
        propertyAddress: string;
        addressKey: string;
        disposition: SalesDoorDisposition;
        notes: string;
        leadId: string | null;
      };
    }
  | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Door details are required." };
  }

  const raw = input as Record<string, unknown>;
  const doorActivityClientEventId = cleanText(
    raw.doorActivityClientEventId,
    80,
  );
  const clientEventId = cleanText(raw.clientEventId, 80);
  if (!UUID_PATTERN.test(doorActivityClientEventId)) {
    return { ok: false, error: "Door activity reference is invalid." };
  }
  if (!UUID_PATTERN.test(clientEventId)) {
    return { ok: false, error: "Door memory retry reference is invalid." };
  }
  if (clientEventId === doorActivityClientEventId) {
    return {
      ok: false,
      error: "Door activity and memory require separate retry references.",
    };
  }

  const propertyAddress = normalizeSalesDoorAddress(
    cleanText(raw.propertyAddress, 260),
  );
  const addressKey = normalizeSalesDoorAddressKey(propertyAddress);
  if (propertyAddress.length < 5 || addressKey.length < 3) {
    return { ok: false, error: "Enter the property address for this door." };
  }

  const disposition = cleanText(raw.disposition, 40) as SalesDoorDisposition;
  if (!SALES_DOOR_DISPOSITIONS.includes(disposition)) {
    return { ok: false, error: "Choose what happened at this door." };
  }

  const notes = cleanText(raw.notes, 1200);
  const leadId = cleanText(raw.leadId, 80) || null;
  if (leadId && !UUID_PATTERN.test(leadId)) {
    return { ok: false, error: "Door homeowner reference is invalid." };
  }

  return {
    ok: true,
    value: {
      doorActivityClientEventId,
      clientEventId,
      propertyAddress,
      addressKey,
      disposition,
      notes,
      leadId,
    },
  };
}

export function validateUpdateSalesLead(input: unknown):
  | {
      ok: true;
      value: {
        leadId: string;
        status: UpdateSalesLeadInput["status"];
        estimatedArrDollars: number;
        serviceInterests: SalesServiceInterest[] | null;
        nextFollowUpAt: string | null;
        notes: string;
      };
    }
  | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Lead update details are required." };
  }

  const raw = input as Record<string, unknown>;
  const leadId = cleanText(raw.leadId, 80);
  if (!UUID_PATTERN.test(leadId)) {
    return { ok: false, error: "Lead reference is invalid." };
  }

  const status = cleanText(raw.status, 40) as UpdateSalesLeadInput["status"];
  if (!EDITABLE_LEAD_STATUSES.has(status)) {
    return {
      ok: false,
      error: "Signed customers are advanced automatically from their agreement.",
    };
  }

  const notes = cleanText(raw.notes, 2000);
  const serviceInterests = validateServiceInterests(
    raw.serviceInterests,
    true,
  );
  if (!serviceInterests.ok) return serviceInterests;
  if (status === "lost" && notes.length < 3) {
    return { ok: false, error: "Add a short reason before closing this lead." };
  }

  let nextFollowUpAt: string | null = null;
  if (raw.nextFollowUpAt) {
    const parsed = new Date(String(raw.nextFollowUpAt));
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: "Choose a valid next-action time." };
    }
    nextFollowUpAt = parsed.toISOString();
  }
  if ((status === "follow_up" || status === "considering") && !nextFollowUpAt) {
    return {
      ok: false,
      error: "Choose when this homeowner should return to the action queue.",
    };
  }
  if (status === "lost") nextFollowUpAt = null;

  const estimatedArrDollars = Number(raw.estimatedArrDollars);
  if (
    !Number.isFinite(estimatedArrDollars) ||
    estimatedArrDollars < 0 ||
    estimatedArrDollars > 1_000_000
  ) {
    return { ok: false, error: "Estimated ARR must be between $0 and $1,000,000." };
  }

  return {
    ok: true,
    value: {
      leadId,
      status,
      estimatedArrDollars: Math.round(estimatedArrDollars * 100) / 100,
      serviceInterests: serviceInterests.value,
      nextFollowUpAt,
      notes,
    },
  };
}

export function validateRecordSalesLeadInteraction(input: unknown):
  | {
      ok: true;
      value: Required<Omit<RecordSalesLeadInteractionInput, "note" | "nextFollowUpAt">> & {
        note: string;
        nextFollowUpAt: string | null;
      };
    }
  | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Follow-up outcome details are required." };
  }

  const raw = input as Record<string, unknown>;
  const leadId = cleanText(raw.leadId, 80);
  const clientEventId = cleanText(raw.clientEventId, 80);
  if (!UUID_PATTERN.test(leadId)) {
    return { ok: false, error: "Lead reference is invalid." };
  }
  if (!UUID_PATTERN.test(clientEventId)) {
    return { ok: false, error: "Follow-up retry reference is invalid." };
  }

  const channel = cleanText(
    raw.channel,
    40,
  ) as RecordSalesLeadInteractionInput["channel"];
  if (!SALES_LEAD_INTERACTION_CHANNELS.includes(channel)) {
    return { ok: false, error: "Choose how the interaction happened." };
  }

  const outcome = cleanText(
    raw.outcome,
    60,
  ) as RecordSalesLeadInteractionInput["outcome"];
  if (!SALES_LEAD_INTERACTION_OUTCOMES.includes(outcome)) {
    return { ok: false, error: "Choose what happened with this lead." };
  }

  const note = cleanText(raw.note, 1200);
  if (outcome === "not_interested" && note.length < 3) {
    return { ok: false, error: "Add a short reason before closing this lead." };
  }

  const expectedLeadUpdatedAt = cleanText(raw.expectedLeadUpdatedAt, 80);
  const expectedTimestamp = new Date(expectedLeadUpdatedAt);
  if (!expectedLeadUpdatedAt || Number.isNaN(expectedTimestamp.getTime())) {
    return {
      ok: false,
      error: "Refresh this lead before recording the follow-up outcome.",
    };
  }

  let nextFollowUpAt: string | null = null;
  if (raw.nextFollowUpAt) {
    const parsed = new Date(String(raw.nextFollowUpAt));
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: "Choose a valid next-action time." };
    }
    nextFollowUpAt = parsed.toISOString();
  }

  if (outcome === "not_interested") {
    if (nextFollowUpAt) {
      return {
        ok: false,
        error: "A closed lead cannot keep a future next action.",
      };
    }
  } else {
    const nextTimestamp = nextFollowUpAt
      ? new Date(nextFollowUpAt).getTime()
      : Number.NaN;
    const now = Date.now();
    if (
      !Number.isFinite(nextTimestamp) ||
      nextTimestamp <= now ||
      nextTimestamp > now + 366 * 24 * 60 * 60 * 1000
    ) {
      return {
        ok: false,
        error: "Choose a future next action within one year.",
      };
    }
  }

  return {
    ok: true,
    value: {
      leadId,
      clientEventId,
      channel,
      outcome,
      note,
      nextFollowUpAt,
      expectedLeadUpdatedAt: expectedTimestamp.toISOString(),
    },
  };
}

export function validateUndoSalesActivity(input: unknown):
  | { ok: true; value: { activityId: string } }
  | { ok: false; error: string } {
  const activityId = cleanText(input, 80);
  if (!UUID_PATTERN.test(activityId)) {
    return { ok: false, error: "Activity reference is invalid." };
  }

  return { ok: true, value: { activityId } };
}
