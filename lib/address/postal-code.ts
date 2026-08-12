/** Canonicalize US ZIP and ZIP+4 input while someone types or pastes it. */
export function normalizeUsPostalCodeInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 9);
  return digits.length > 5
    ? `${digits.slice(0, 5)}-${digits.slice(5)}`
    : digits;
}

export function isValidUsPostalCode(value: string): boolean {
  return /^\d{5}(?:-\d{4})?$/.test(normalizeUsPostalCodeInput(value));
}
