const PLACEHOLDER_VALUES = new Set([
  "tbd",
  "tba",
  "pending",
  "n/a",
  "na",
  "unknown",
  "null",
  "undefined",
  "none",
  "—",
  "-",
  ".",
]);

export function isPortalAddressPlaceholder(
  value: string | null | undefined,
): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return true;
  const normalized = trimmed.toLowerCase();
  if (PLACEHOLDER_VALUES.has(normalized)) return true;
  if (/^tbd\b/i.test(normalized)) return true;
  return false;
}

/** Title-case lowercase words; preserve mixed-case tokens like "Drive" or "MAC". */
export function formatPortalAddressToken(value: string): string {
  return value.replace(/\b[a-z]+\b/g, (word) => {
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
}

/** Remove placeholder segments from a comma-separated address line. */
export function stripPortalAddressPlaceholders(value: string): string {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !isPortalAddressPlaceholder(part))
    .map(formatPortalAddressToken)
    .join(", ");
}

export interface PortalPropertyAddressInput {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

/**
 * Customer portal address — never shows TBD or other internal placeholders.
 * Locality (city/state) only appears when city is known.
 */
export function formatPortalPropertyAddress(
  input: PortalPropertyAddressInput,
): string {
  const rawStreet = isPortalAddressPlaceholder(input.address)
    ? ""
    : input.address!.trim();
  const street = rawStreet ? stripPortalAddressPlaceholders(rawStreet) : "";

  const city = isPortalAddressPlaceholder(input.city) ? "" : input.city!.trim();
  const state = isPortalAddressPlaceholder(input.state)
    ? ""
    : input.state!.trim().toUpperCase();
  const zip = isPortalAddressPlaceholder(input.zip) ? "" : input.zip!.trim();

  const localityParts: string[] = [];
  if (city) {
    localityParts.push(formatPortalAddressToken(city));
    if (state) {
      localityParts.push(zip ? `${state} ${zip}` : state);
    } else if (zip) {
      localityParts.push(zip);
    }
  }

  const locality = localityParts.join(", ");

  let formatted = "";
  if (street && locality) formatted = `${street}, ${locality}`;
  else if (street) formatted = street;
  else formatted = locality;

  return stripPortalAddressPlaceholders(formatted);
}
