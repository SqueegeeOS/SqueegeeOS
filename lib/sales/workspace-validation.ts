import {
  SALES_ACTIVITY_TYPES,
  type CreateSalesLeadInput,
  type SalesActivityType,
} from "./workspace-types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_PATTERN = /^\+[1-9]\d{7,14}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
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
  | { ok: true; value: Required<Omit<CreateSalesLeadInput, "phone" | "email" | "nextFollowUpAt" | "notes">> & {
      phone: string | null;
      email: string | null;
      nextFollowUpAt: string | null;
      notes: string;
    } }
  | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Lead details are required." };
  }

  const raw = input as Record<string, unknown>;
  const fullName = cleanText(raw.fullName, 140);
  const propertyAddress = cleanText(raw.propertyAddress, 260);
  const rawPhone = cleanText(raw.phone, 40);
  const phone = normalizeNorthAmericanPhone(rawPhone);
  const email = cleanText(raw.email, 320).toLowerCase() || null;
  const notes = cleanText(raw.notes, 2000);
  const smsConsentAttested = raw.smsConsentAttested === true;
  const emailConsentAttested = raw.emailConsentAttested === true;

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
  if (smsConsentAttested && !phone) {
    return { ok: false, error: "A phone number is required for text permission." };
  }
  if (emailConsentAttested && !email) {
    return { ok: false, error: "An email address is required for email permission." };
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
      fullName,
      propertyAddress,
      phone,
      email,
      estimatedArrDollars: Math.round(estimatedArrDollars * 100) / 100,
      nextFollowUpAt,
      notes,
      smsConsentAttested,
      emailConsentAttested,
    },
  };
}

export function validateCreateSalesActivity(input: unknown):
  | { ok: true; value: { activityType: SalesActivityType; quantity: number; leadId: string | null } }
  | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Activity details are required." };
  }

  const raw = input as Record<string, unknown>;
  const activityType = cleanText(raw.activityType, 80) as SalesActivityType;
  if (!SALES_ACTIVITY_TYPES.includes(activityType)) {
    return { ok: false, error: "Choose a valid field activity." };
  }

  const quantity = Number(raw.quantity ?? 1);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
    return { ok: false, error: "Activity count must be between 1 and 100." };
  }

  const leadId = cleanText(raw.leadId, 80) || null;
  if (leadId && !UUID_PATTERN.test(leadId)) {
    return { ok: false, error: "Lead reference is invalid." };
  }

  return { ok: true, value: { activityType, quantity, leadId } };
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
