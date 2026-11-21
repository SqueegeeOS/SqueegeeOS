import { MAX_VISIT_PHOTO_BYTES, type VisitPhotoMimeType } from "./visit-field-record";

// Input only: the signed upload and bucket still enforce the original 15 MiB limit.
export const MAX_VISIT_PHOTO_SOURCE_BYTES = 40 * 1024 * 1024;
const OPTIMIZE_ABOVE_BYTES = 2 * 1024 * 1024;
const MAX_EDGE = 2560;

/** Read provider-backed files while the picker grant is fresh, before Save. */
export async function prepareVisitPhoto(file: File, mimeType: VisitPhotoMimeType): Promise<File> {
  let bytes: ArrayBuffer;
  try {
    bytes = await file.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength !== file.size) throw new Error("Incomplete photo");
  } catch {
    throw new Error(`${file.name}: this phone could not read the photo. Download it to this device in Photos, then select it again, or use Take photo.`);
  }
  const local = new File([bytes], file.name, { type: mimeType, lastModified: file.lastModified });
  let prepared = local;
  // HEIC/HEIF are kept intact. Browser decoding support varies; never rename their bytes as JPEG.
  if (local.size > OPTIMIZE_ABOVE_BYTES && ["image/jpeg", "image/png", "image/webp"].includes(mimeType) && typeof createImageBitmap === "function") {
    let bitmap: ImageBitmap | undefined;
    try {
      bitmap = await createImageBitmap(local);
      const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (context) {
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
        if (blob?.type === "image/jpeg" && blob.size > 0 && blob.size < local.size) {
          prepared = new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
        }
      }
    } catch {
      // Keep a readable original when this browser cannot decode/encode it.
    } finally {
      bitmap?.close();
    }
  }
  if (prepared.size > MAX_VISIT_PHOTO_BYTES) {
    throw new Error(`${file.name}: this photo is still over 15 MB. Choose a smaller photo or use Take photo at standard resolution.`);
  }
  return prepared;
}
