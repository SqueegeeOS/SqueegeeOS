export interface UsPropertyAddressParts {
  street: string;
  city: string;
  state: string;
  zip: string;
}

function compact(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Produce the same readable US property identity everywhere HomeAtlas captures
 * an address. Empty pieces stay editable instead of blocking manual entry.
 */
export function formatUsPropertyAddress(
  parts: UsPropertyAddressParts,
): string {
  const street = compact(parts.street);
  const city = compact(parts.city);
  const stateZip = [
    compact(parts.state).toUpperCase(),
    compact(parts.zip),
  ]
    .filter(Boolean)
    .join(" ");

  return [street, city, stateZip].filter(Boolean).join(", ");
}

/** Remove Google's country suffix while keeping its readable fallback. */
export function formatAddressSuggestionFallback(label: string): string {
  return compact(label).replace(/,\s*(?:USA|United States)$/i, "");
}
