export const JOBBER_SYNC_BATCH_SIZE = 500;

export function chunkItems<T>(
  items: readonly T[],
  size = JOBBER_SYNC_BATCH_SIZE,
): T[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error("Batch size must be a positive integer");
  }
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export function buildSearchText(
  values: Array<string | number | null | undefined>,
): string {
  return values
    .filter((value): value is string | number => value !== null && value !== undefined)
    .map((value) => String(value).trim().toLocaleLowerCase("en-US"))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .slice(0, 2000);
}

/** Escape wildcard characters before passing a user term to PostgREST ilike. */
export function escapeLikePattern(value: string): string {
  return value.trim().slice(0, 120).replace(/[\\%_]/g, "\\$&");
}

export function toBoundedInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(value!)));
}

export function summarizeProjectionChanges(
  rows: Array<{ externalId: string; payloadHash: string }>,
  existing: Map<string, string>,
): { inserted: number; changed: number; unchanged: number } {
  let inserted = 0;
  let changed = 0;
  let unchanged = 0;
  for (const row of rows) {
    const previousHash = existing.get(row.externalId);
    if (!previousHash) inserted += 1;
    else if (previousHash !== row.payloadHash) changed += 1;
    else unchanged += 1;
  }
  return { inserted, changed, unchanged };
}
