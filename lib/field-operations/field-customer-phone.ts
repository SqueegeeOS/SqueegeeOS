export interface FieldCustomerPhone {
  number: string;
  primary: boolean;
}

/** Only validated dialable numbers may be included in Field Pass responses. */
export function normalizeFieldCustomerPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const input = value.trim();
  if (input.length > 40 || !/^\+?[\d(). -]+$/.test(input)) return null;
  const compact = input.replace(/[(). -]/g, "");
  if (/^[2-9]\d{2}[2-9]\d{6}$/.test(compact)) return "+1" + compact;
  if (/^1[2-9]\d{2}[2-9]\d{6}$/.test(compact)) return "+" + compact;
  if (/^\+1/.test(compact) && !/^\+1[2-9]\d{2}[2-9]\d{6}$/.test(compact)) return null;
  return /^\+[1-9]\d{7,14}$/.test(compact) ? compact : null;
}

/** Legacy projections have only the primary scalar; newer syncs can have both. */
export function jobberFieldCustomerPhones(primary: unknown, additional: unknown): FieldCustomerPhone[] {
  const primaryNumber = normalizeFieldCustomerPhone(primary);
  const phones = new Map<string, boolean>();
  if (primaryNumber) phones.set(primaryNumber, true);
  let hasPrimary = Boolean(primaryNumber);
  if (Array.isArray(additional)) {
    for (const item of additional) {
      if (!item || typeof item !== "object") continue;
      const { number, primary } = item as Record<string, unknown>;
      const normalized = normalizeFieldCustomerPhone(number);
      if (!normalized) continue;
      if (primary === true && !hasPrimary) {
        phones.set(normalized, true);
        hasPrimary = true;
      } else if (!phones.has(normalized)) {
        phones.set(normalized, false);
      }
    }
  }
  return [...phones].map(([number, primary]) => ({ number, primary }))
    .sort((a, b) => Number(b.primary) - Number(a.primary));
}

export function fieldCustomerPhoneLabel(number: string): string {
  const parts = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(number);
  return parts ? "(" + parts[1] + ") " + parts[2] + "-" + parts[3] : number;
}
