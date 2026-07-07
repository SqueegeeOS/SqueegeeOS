import {
  createServiceRoleSupabaseClient,
  getSupabaseUrl,
  isServiceRoleConfigured,
} from "@/lib/persistence/supabase/client";

export const SIGNED_AGREEMENT_BUCKET = "signed-agreements";
export const SIGNED_AGREEMENT_STORAGE_REF_PREFIX = `storage:${SIGNED_AGREEMENT_BUCKET}/`;

/** Default signed URL lifetime for portal / API access (1 hour). */
export const SIGNED_AGREEMENT_URL_TTL_SECONDS = 60 * 60;

export function formatSignedAgreementStorageRef(fileName: string): string {
  return `${SIGNED_AGREEMENT_STORAGE_REF_PREFIX}${fileName}`;
}

export function parseSignedAgreementStoragePath(
  stored: string | null | undefined,
): string | null {
  if (!stored?.trim()) return null;

  if (stored.startsWith(SIGNED_AGREEMENT_STORAGE_REF_PREFIX)) {
    return stored.slice(SIGNED_AGREEMENT_STORAGE_REF_PREFIX.length);
  }

  const publicMarker = `/object/public/${SIGNED_AGREEMENT_BUCKET}/`;
  const publicIndex = stored.indexOf(publicMarker);
  if (publicIndex !== -1) {
    return stored.slice(publicIndex + publicMarker.length).split("?")[0] || null;
  }

  const signedMarker = `/object/sign/${SIGNED_AGREEMENT_BUCKET}/`;
  const signedIndex = stored.indexOf(signedMarker);
  if (signedIndex !== -1) {
    return stored.slice(signedIndex + signedMarker.length).split("?")[0] || null;
  }

  return null;
}

export function isSignedAgreementStorageRef(
  stored: string | null | undefined,
): boolean {
  return Boolean(stored?.startsWith(SIGNED_AGREEMENT_STORAGE_REF_PREFIX));
}

export async function createSignedAgreementAccessUrl(
  fileName: string,
  expiresInSeconds = SIGNED_AGREEMENT_URL_TTL_SECONDS,
): Promise<string | null> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.storage
    .from(SIGNED_AGREEMENT_BUCKET)
    .createSignedUrl(fileName, expiresInSeconds);

  if (error || !data?.signedUrl) {
    console.error(
      "[agreement-storage] failed to create signed URL:",
      error?.message ?? "unknown error",
    );
    return null;
  }

  return data.signedUrl;
}

/**
 * Resolve a stored agreement reference to a short-lived HTTPS URL.
 * Legacy public URLs are re-signed when the bucket is private.
 */
export async function resolveAgreementPdfAccessUrl(
  stored: string | null | undefined,
  expiresInSeconds = SIGNED_AGREEMENT_URL_TTL_SECONDS,
): Promise<string | null> {
  if (!stored?.trim()) return null;
  if (stored.startsWith("data:")) return stored;

  const storagePath = parseSignedAgreementStoragePath(stored);
  if (storagePath && isServiceRoleConfigured()) {
    return createSignedAgreementAccessUrl(storagePath, expiresInSeconds);
  }

  if (stored.startsWith("https://") || stored.startsWith("http://")) {
    return stored;
  }

  return null;
}

/** HEAD probe: public buckets return 404 for missing objects; private buckets return 400. */
export async function probeSignedAgreementsBucketPublic(): Promise<
  "public" | "private" | "unknown"
> {
  try {
    const response = await fetch(
      `${getSupabaseUrl()}/storage/v1/object/public/${SIGNED_AGREEMENT_BUCKET}/.production-check-probe`,
      { method: "HEAD", cache: "no-store" },
    );

    if (response.status === 400) return "private";
    if (response.status === 404 || response.status === 200) return "public";
    return "unknown";
  } catch {
    return "unknown";
  }
}
