import { zonedDateTimeToUtc } from "@/lib/admin/company-business-timezone";

export const VISIT_MEDIA_BUCKET = "homeatlas-visit-media";
export const MAX_VISIT_PHOTOS = 8;
export const MAX_VISIT_PHOTO_BYTES = 15 * 1024 * 1024;

export const VISIT_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export type VisitPhotoMimeType = (typeof VISIT_PHOTO_MIME_TYPES)[number];
export type VisitPhotoCaptureType = "before" | "after" | "detail";

export interface VisitPhotoDescriptor {
  clientId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  captureType: VisitPhotoCaptureType;
  customerVisible: boolean;
}

export interface VisitPhotoUploadIntent extends VisitPhotoDescriptor {
  storagePath: string;
  token: string;
}

export interface VisitPhotoUploadRequest {
  fieldRecordId: string;
  propertyId: string;
  appointmentId: string;
  photos: VisitPhotoDescriptor[];
}

export interface VisitFieldRecordCommitInput {
  fieldRecordId: string;
  propertyId: string;
  appointmentId: string;
  technicianName: string;
  visitDate: string;
  customerSummary: string;
  internalNote: string;
  followUpNeeded: boolean;
  photos: Array<Omit<VisitPhotoUploadIntent, "token">>;
}

export interface VisitFieldFollowUpView {
  assessmentId: string;
  fieldRecordId: string | null;
  propertyId: string;
  appointmentId: string | null;
  homeownerName: string;
  propertyName: string;
  propertyAddress: string;
  technicianName: string;
  visitDate: string;
  customerSummary: string | null;
  internalNote: string | null;
  dueAt: string;
  createdAt: string;
}

export interface ResolveVisitFieldFollowUpInput {
  assessmentId: string;
  resolvedBy: string;
}

export type VisitFieldFollowUpMoment = "overdue" | "due_today" | "upcoming";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EXTENSION_BY_MIME_TYPE: Record<VisitPhotoMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

const FOLLOW_UP_DAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function pacificCalendarDateKey(value: Date): string {
  const parts = new Map(
    FOLLOW_UP_DAY_FORMATTER.formatToParts(value).map((part) => [
      part.type,
      part.value,
    ]),
  );
  return `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}`;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function isVisitPhotoMimeType(
  value: unknown,
): value is VisitPhotoMimeType {
  return VISIT_PHOTO_MIME_TYPES.includes(value as VisitPhotoMimeType);
}

export function isVisitPhotoCaptureType(
  value: unknown,
): value is VisitPhotoCaptureType {
  return value === "before" || value === "after" || value === "detail";
}

export function extensionForVisitPhotoMimeType(
  mimeType: VisitPhotoMimeType,
): string {
  return EXTENSION_BY_MIME_TYPE[mimeType];
}

export function buildVisitPhotoStoragePath(input: {
  propertyId: string;
  appointmentId: string;
  fieldRecordId: string;
  objectId: string;
  mimeType: VisitPhotoMimeType;
}): string {
  return [
    "properties",
    input.propertyId,
    "visits",
    input.appointmentId,
    "records",
    input.fieldRecordId,
    `${input.objectId}.${extensionForVisitPhotoMimeType(input.mimeType)}`,
  ].join("/");
}

export function visitPhotoStoragePrefix(input: {
  propertyId: string;
  appointmentId: string;
  fieldRecordId: string;
}): string {
  return `properties/${input.propertyId}/visits/${input.appointmentId}/records/${input.fieldRecordId}/`;
}

export function validateVisitPhotoDescriptors(
  photos: VisitPhotoDescriptor[],
): string | null {
  if (!Array.isArray(photos)) return "photos must be an array.";
  if (photos.length > MAX_VISIT_PHOTOS) {
    return `Add no more than ${MAX_VISIT_PHOTOS} photos to one visit record.`;
  }

  const clientIds = new Set<string>();
  for (const photo of photos) {
    if (!isUuid(photo.clientId)) return "Each photo needs a valid client ID.";
    if (clientIds.has(photo.clientId)) return "Duplicate photo client ID.";
    clientIds.add(photo.clientId);
    if (!photo.fileName?.trim() || photo.fileName.length > 180) {
      return "Each photo needs a valid file name.";
    }
    if (photo.fileName.includes("/") || photo.fileName.includes("\\")) {
      return "Photo file names cannot contain paths.";
    }
    if (!isVisitPhotoMimeType(photo.mimeType)) {
      return "Use a JPEG, PNG, WebP, HEIC, or HEIF photo.";
    }
    if (
      !Number.isInteger(photo.sizeBytes) ||
      photo.sizeBytes < 1 ||
      photo.sizeBytes > MAX_VISIT_PHOTO_BYTES
    ) {
      return "Each photo must be 15 MB or smaller.";
    }
    if (!isVisitPhotoCaptureType(photo.captureType)) {
      return "Each photo needs a before, after, or detail label.";
    }
    if (typeof photo.customerVisible !== "boolean") {
      return "Each photo needs an explicit portal visibility choice.";
    }
  }
  return null;
}

export function validateVisitPhotoUploadRequest(
  input: VisitPhotoUploadRequest,
): string | null {
  if (!isUuid(input.fieldRecordId)) return "fieldRecordId must be a UUID.";
  if (!isUuid(input.propertyId)) return "propertyId must be a UUID.";
  if (!isUuid(input.appointmentId)) return "appointmentId must be a UUID.";
  if (!Array.isArray(input.photos) || input.photos.length === 0) {
    return "Choose at least one photo to upload.";
  }
  return validateVisitPhotoDescriptors(input.photos);
}

function isIsoCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function nextVisitFieldFollowUpDueAt(visitDate: string): string {
  if (!isIsoCalendarDate(visitDate)) {
    throw new Error("visitDate must be a valid calendar date.");
  }
  const [year, month, day] = visitDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay();
  const daysToAdd = dayOfWeek === 5 ? 3 : dayOfWeek === 6 ? 2 : 1;
  date.setUTCDate(date.getUTCDate() + daysToAdd);
  return zonedDateTimeToUtc(
    date.toISOString().slice(0, 10),
    9,
    0,
    0,
  ).toISOString();
}

export function validateVisitFieldRecordCommit(
  input: VisitFieldRecordCommitInput,
): string | null {
  if (!isUuid(input.fieldRecordId)) return "fieldRecordId must be a UUID.";
  if (!isUuid(input.propertyId)) return "propertyId must be a UUID.";
  if (!isUuid(input.appointmentId)) return "appointmentId must be a UUID.";
  if (!input.technicianName?.trim()) return "Enter who documented the visit.";
  if (input.technicianName.trim().length > 80) {
    return "Technician name must be 80 characters or fewer.";
  }
  if (!isIsoCalendarDate(input.visitDate)) return "Enter a valid visit date.";
  if ((input.customerSummary ?? "").trim().length > 1_200) {
    return "Customer update must be 1,200 characters or fewer.";
  }
  if ((input.internalNote ?? "").trim().length > 2_500) {
    return "Internal note must be 2,500 characters or fewer.";
  }
  if (typeof input.followUpNeeded !== "boolean") {
    return "followUpNeeded must be true or false.";
  }

  const photoError = validateVisitPhotoDescriptors(input.photos);
  if (photoError) return photoError;
  if (
    !input.customerSummary.trim() &&
    !input.internalNote.trim() &&
    input.photos.length === 0
  ) {
    return "Add a customer update, an internal note, or at least one photo.";
  }

  const requiredPrefix = visitPhotoStoragePrefix(input);
  for (const photo of input.photos) {
    if (!photo.storagePath?.startsWith(requiredPrefix)) {
      return "A photo path does not belong to this visit record.";
    }
    const relativeObject = photo.storagePath.slice(requiredPrefix.length);
    if (!/^[0-9a-f-]+\.(?:jpg|png|webp|heic|heif)$/i.test(relativeObject)) {
      return "A photo path is malformed.";
    }
    const expectedExtension = extensionForVisitPhotoMimeType(
      photo.mimeType as VisitPhotoMimeType,
    );
    if (!relativeObject.toLowerCase().endsWith(`.${expectedExtension}`)) {
      return "A photo path does not match its file type.";
    }
  }

  return null;
}

export function validateResolveVisitFieldFollowUp(
  input: ResolveVisitFieldFollowUpInput,
): string | null {
  if (!isUuid(input.assessmentId)) return "assessmentId must be a UUID.";
  if (!input.resolvedBy?.trim()) return "Enter who completed the follow-up.";
  if (input.resolvedBy.trim().length > 80) {
    return "Completed-by name must be 80 characters or fewer.";
  }
  return null;
}

export function classifyVisitFieldFollowUp(
  dueAt: string,
  now: Date,
): VisitFieldFollowUpMoment {
  const due = new Date(dueAt);
  if (!Number.isFinite(due.getTime())) return "overdue";

  const dueDay = pacificCalendarDateKey(due);
  const today = pacificCalendarDateKey(now);

  if (dueDay < today) return "overdue";
  if (dueDay === today) return "due_today";
  return "upcoming";
}

export function visitPhotoTitle(captureType: VisitPhotoCaptureType): string {
  if (captureType === "before") return "Before service";
  if (captureType === "after") return "After service";
  return "Visit detail";
}
