import {
  MAX_VISIT_PHOTOS,
  MAX_VISIT_PHOTO_BYTES,
  isVisitPhotoMimeType,
  type VisitPhotoMimeType,
  VISIT_PHOTO_MIME_TYPES,
} from "@/lib/field-records/visit-field-record";

const MIME_BY_EXTENSION: Record<string, VisitPhotoMimeType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

// Extensions help phone photo providers which do not supply a MIME type.
// These are picker hints, not a replacement for the server's validation.
export const VISIT_PHOTO_ACCEPT = [
  ...VISIT_PHOTO_MIME_TYPES,
  ...Object.keys(MIME_BY_EXTENSION).map((extension) => `.${extension}`),
].join(",");

export function resolveVisitPhotoMimeType(
  file: Pick<File, "type" | "name">,
): VisitPhotoMimeType | null {
  const type = file.type.trim().toLowerCase();
  if (isVisitPhotoMimeType(type)) return type;
  if (type === "image/jpg") return "image/jpeg";
  // Do not disguise an explicitly unsupported format as a photo.
  if (type && type !== "application/octet-stream") return null;
  const extension = file.name.match(/\.([^.]+)$/)?.[1].toLowerCase() ?? "";
  return Object.hasOwn(MIME_BY_EXTENSION, extension) ? MIME_BY_EXTENSION[extension] : null;
}

export function selectVisitPhotos<T extends Pick<File, "type" | "name" | "size">>(
  files: readonly T[],
  selectedCount: number,
): { accepted: Array<{ file: T; mimeType: VisitPhotoMimeType }>; errors: string[] } {
  const accepted: Array<{ file: T; mimeType: VisitPhotoMimeType }> = [];
  const errors: string[] = [];
  for (const file of files) {
    const mimeType = resolveVisitPhotoMimeType(file);
    if (!mimeType) {
      errors.push(`${file.name}: choose a JPG, PNG, WebP, HEIC, or HEIF photo.`);
    } else if (file.size < 1 || file.size > MAX_VISIT_PHOTO_BYTES) {
      errors.push(`${file.name}: choose a photo between 1 byte and 15 MB.`);
    } else if (selectedCount + accepted.length >= MAX_VISIT_PHOTOS) {
      errors.push(`${file.name}: this record can hold ${MAX_VISIT_PHOTOS} photos. Save these, then add another update.`);
    } else {
      accepted.push({ file, mimeType });
    }
  }
  return { accepted, errors };
}
