import {
  isUuid,
  MAX_VISIT_PHOTOS,
} from "@/lib/field-records/visit-field-record";

export const VISIT_FIELD_DRAFT_TTL_MS = 72 * 60 * 60 * 1_000;

const VISIT_FIELD_DRAFT_VERSION = 1 as const;
const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1_000;

export interface VisitFieldDraftScope {
  propertyId: string;
  appointmentId: string;
}

export interface VisitFieldDraft extends VisitFieldDraftScope {
  version: typeof VISIT_FIELD_DRAFT_VERSION;
  fieldRecordId: string;
  technicianName: string;
  visitDate: string;
  customerSummary: string;
  internalNote: string;
  followUpNeeded: boolean;
  completedScopeItemIds?: string[];
  scopeException?: string;
  selectedPhotoCount: number;
  savedAt: number;
}

type VisitFieldDraftStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

function isIsoCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function isValidVisitFieldDraft(
  value: unknown,
  scope: VisitFieldDraftScope,
  now: number,
): value is VisitFieldDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<VisitFieldDraft>;

  return (
    draft.version === VISIT_FIELD_DRAFT_VERSION &&
    draft.propertyId === scope.propertyId &&
    draft.appointmentId === scope.appointmentId &&
    isUuid(draft.fieldRecordId) &&
    typeof draft.technicianName === "string" &&
    draft.technicianName.length <= 80 &&
    isIsoCalendarDate(draft.visitDate) &&
    typeof draft.customerSummary === "string" &&
    draft.customerSummary.length <= 1_200 &&
    typeof draft.internalNote === "string" &&
    draft.internalNote.length <= 2_500 &&
    typeof draft.followUpNeeded === "boolean" &&
    (draft.completedScopeItemIds === undefined ||
      (Array.isArray(draft.completedScopeItemIds) &&
        draft.completedScopeItemIds.length <= 50 &&
        new Set(draft.completedScopeItemIds).size ===
          draft.completedScopeItemIds.length &&
        draft.completedScopeItemIds.every(
          (id) => typeof id === "string" && id.length > 0 && id.length <= 200,
        ))) &&
    (draft.scopeException === undefined ||
      (typeof draft.scopeException === "string" &&
        draft.scopeException.length <= 1_200)) &&
    Number.isInteger(draft.selectedPhotoCount) &&
    (draft.selectedPhotoCount ?? -1) >= 0 &&
    (draft.selectedPhotoCount ?? MAX_VISIT_PHOTOS + 1) <= MAX_VISIT_PHOTOS &&
    typeof draft.savedAt === "number" &&
    Number.isFinite(draft.savedAt) &&
    draft.savedAt <= now + MAX_FUTURE_CLOCK_SKEW_MS &&
    now - draft.savedAt <= VISIT_FIELD_DRAFT_TTL_MS
  );
}

export function visitFieldDraftStorageKey(
  scope: VisitFieldDraftScope,
): string {
  return `homeatlas:visit-field-draft:v1:${scope.propertyId}:${scope.appointmentId}`;
}

export function readVisitFieldDraft(
  storage: VisitFieldDraftStorage,
  scope: VisitFieldDraftScope,
  now = Date.now(),
): VisitFieldDraft | null {
  const key = visitFieldDraftStorageKey(scope);
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (isValidVisitFieldDraft(value, scope, now)) return value;
    storage.removeItem(key);
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // Private browsing and locked-down devices can deny local storage.
    }
  }
  return null;
}

export function writeVisitFieldDraft(
  storage: VisitFieldDraftStorage,
  draft: VisitFieldDraft,
  now = Date.now(),
): boolean {
  if (!isValidVisitFieldDraft(draft, draft, now)) return false;
  try {
    storage.setItem(visitFieldDraftStorageKey(draft), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearVisitFieldDraft(
  storage: VisitFieldDraftStorage,
  scope: VisitFieldDraftScope,
): boolean {
  try {
    storage.removeItem(visitFieldDraftStorageKey(scope));
    return true;
  } catch {
    return false;
  }
}
