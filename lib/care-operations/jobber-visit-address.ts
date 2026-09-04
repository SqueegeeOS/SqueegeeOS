/** Only use the exact visit's structured address, never a customer/property name. */
export function formatJobberVisitAddress(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const read = (key: string) => {
    const value = row[key];
    return typeof value === "string" && value.length <= 300
      ? value.trim().replace(/\s+/g, " ") : "";
  };
  const street = read("street1");
  const city = read("city");
  // A street alone may exist in many towns. Do not send a technician to a guess.
  if (!street || !city) return null;
  return [street, read("street2"), city, read("province"), read("postalCode"), read("country")]
    .filter(Boolean).join(", ");
}

export function jobDirectionsHref(address: string | null | undefined): string | null {
  if (!address?.trim()) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address.trim())}`;
}
