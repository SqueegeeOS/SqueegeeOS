const PLACEHOLDER_VALUES = new Set([
  "tbd",
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
  return PLACEHOLDER_VALUES.has(trimmed.toLowerCase());
}

/** Title-case lowercase words; preserve mixed-case tokens like "Drive" or "MAC". */
export function formatPortalAddressToken(value: string): string {
  return value.replace(/\b[a-z]+\b/g, (word) => {
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
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
  const street = isPortalAddressPlaceholder(input.address)
    ? ""
    : formatPortalAddressToken(input.address!.trim());

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

  if (street && locality) return `${street}, ${locality}`;
  if (street) return street;
  return locality;
}
