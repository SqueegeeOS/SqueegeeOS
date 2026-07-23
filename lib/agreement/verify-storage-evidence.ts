import "server-only";

import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";

export function storedEvidenceMatches(
  expected: Uint8Array,
  actual: Uint8Array,
): boolean {
  if (expected.byteLength !== actual.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < expected.byteLength; index += 1) {
    difference |= expected[index] ^ actual[index];
  }
  return difference === 0;
}

export async function verifyExistingStorageEvidence(
  bucket: string,
  path: string,
  expected: Uint8Array,
): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) {
    throw new Error(
      `Existing signed evidence could not be read: ${error?.message ?? "empty object"}`,
    );
  }
  const actual = new Uint8Array(await data.arrayBuffer());
  if (!storedEvidenceMatches(expected, actual)) {
    throw new Error("Existing signed evidence conflicts with this attempt");
  }
}
