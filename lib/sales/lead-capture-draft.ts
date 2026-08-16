import type { CreateSalesLeadInput } from "./workspace-types";
import { normalizeSalesServiceInterests } from "./service-interests";

export const SALES_LEAD_CAPTURE_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const DRAFT_VERSION = 1;
const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

interface PersistedSalesLeadCaptureDraft {
  version: typeof DRAFT_VERSION;
  repSlug: string;
  savedAt: string;
  form: Omit<
    CreateSalesLeadInput,
    "smsConsentAttested" | "emailConsentAttested"
  >;
}

function boundedString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function nullableString(value: unknown, maxLength: number): string | null {
  const result = boundedString(value, maxLength);
  return result || null;
}

export function salesLeadCaptureDraftStorageKey(repSlug: string): string {
  return `homeatlas.sales-lead-draft.v1.${repSlug.trim().toLowerCase()}`;
}

export function hasMeaningfulSalesLeadCaptureDraft(
  form: CreateSalesLeadInput,
): boolean {
  return Boolean(
    form.fullName.trim() ||
      form.propertyAddress.trim() ||
      form.phone?.trim() ||
      form.email?.trim() ||
      form.nextFollowUpAt ||
      form.notes?.trim() ||
      normalizeSalesServiceInterests(form.serviceInterests).length > 1 ||
      form.doorMemoryClientEventId,
  );
}

export function serializeSalesLeadCaptureDraft(
  repSlug: string,
  form: CreateSalesLeadInput,
  savedAt = new Date(),
): string {
  const payload: PersistedSalesLeadCaptureDraft = {
    version: DRAFT_VERSION,
    repSlug: repSlug.trim().toLowerCase(),
    savedAt: savedAt.toISOString(),
    // Permission attestations deliberately do not survive a reload. The rep
    // must hear and reconfirm the customer's choice before saving.
    form: {
      clientEventId: form.clientEventId,
      fullName: form.fullName,
      propertyAddress: form.propertyAddress,
      phone: form.phone ?? null,
      email: form.email ?? null,
      serviceInterests: normalizeSalesServiceInterests(form.serviceInterests),
      estimatedArrDollars: form.estimatedArrDollars ?? 0,
      nextFollowUpAt: form.nextFollowUpAt ?? null,
      notes: form.notes ?? null,
      doorMemoryClientEventId: form.doorMemoryClientEventId ?? null,
    },
  };
  return JSON.stringify(payload);
}

export function parseSalesLeadCaptureDraft(
  rawValue: string | null,
  repSlug: string,
  now = new Date(),
): CreateSalesLeadInput | null {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as Partial<PersistedSalesLeadCaptureDraft>;
    if (
      parsed.version !== DRAFT_VERSION ||
      parsed.repSlug !== repSlug.trim().toLowerCase() ||
      !parsed.form ||
      typeof parsed.form !== "object"
    ) {
      return null;
    }

    const savedAt = Date.parse(String(parsed.savedAt ?? ""));
    if (
      !Number.isFinite(savedAt) ||
      savedAt > now.getTime() + 60_000 ||
      now.getTime() - savedAt > SALES_LEAD_CAPTURE_DRAFT_TTL_MS
    ) {
      return null;
    }

    const form = parsed.form as Record<string, unknown>;
    const clientEventId = boundedString(form.clientEventId, 80);
    if (!UUID_PATTERN.test(clientEventId)) return null;

    const doorMemoryClientEventId = nullableString(
      form.doorMemoryClientEventId,
      80,
    );
    if (
      doorMemoryClientEventId &&
      (!UUID_PATTERN.test(doorMemoryClientEventId) ||
        doorMemoryClientEventId === clientEventId)
    ) {
      return null;
    }

    const estimatedArrDollars = Number(form.estimatedArrDollars ?? 0);
    if (
      !Number.isFinite(estimatedArrDollars) ||
      estimatedArrDollars < 0 ||
      estimatedArrDollars > 1_000_000
    ) {
      return null;
    }

    const rawNextFollowUpAt = nullableString(form.nextFollowUpAt, 80);
    const nextFollowUpAt =
      rawNextFollowUpAt && Number.isFinite(Date.parse(rawNextFollowUpAt))
        ? rawNextFollowUpAt
        : null;

    return {
      clientEventId,
      fullName: boundedString(form.fullName, 140),
      propertyAddress: boundedString(form.propertyAddress, 260),
      phone: nullableString(form.phone, 40),
      email: nullableString(form.email, 320),
      serviceInterests: normalizeSalesServiceInterests(form.serviceInterests),
      estimatedArrDollars: Math.round(estimatedArrDollars * 100) / 100,
      nextFollowUpAt,
      notes: nullableString(form.notes, 2000),
      smsConsentAttested: false,
      emailConsentAttested: false,
      doorMemoryClientEventId,
    };
  } catch {
    return null;
  }
}
