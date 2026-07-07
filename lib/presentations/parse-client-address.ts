export interface ParsedClientAddress {
  address: string;
  city: string;
  state: string;
  zip: string;
  propertyName: string;
}

const STATE_ZIP_PATTERN = /,\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)\s*$/;

/**
 * Best-effort parse of a single-line client address from presentations.
 * Falls back to safe defaults when city/state/zip are missing.
 */
export function parseClientAddress(
  raw: string,
  fallbackName?: string,
): ParsedClientAddress {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      address: fallbackName?.trim() || "Property",
      city: "TBD",
      state: "CA",
      zip: "",
      propertyName: fallbackName?.trim() || "Property",
    };
  }

  const stateZipMatch = trimmed.match(STATE_ZIP_PATTERN);
  if (!stateZipMatch) {
    return {
      address: trimmed,
      city: "TBD",
      state: "CA",
      zip: "",
      propertyName: fallbackName?.trim() || trimmed,
    };
  }

  const state = stateZipMatch[1].toUpperCase();
  const zip = stateZipMatch[2];
  const beforeState = trimmed.slice(0, stateZipMatch.index).trim();
  const commaParts = beforeState.split(",").map((part) => part.trim()).filter(Boolean);

  if (commaParts.length >= 2) {
    const city = commaParts[commaParts.length - 1];
    const address = commaParts.slice(0, -1).join(", ");
    return {
      address,
      city,
      state,
      zip,
      propertyName: fallbackName?.trim() || address || city,
    };
  }

  return {
    address: beforeState,
    city: "TBD",
    state,
    zip,
    propertyName: fallbackName?.trim() || beforeState,
  };
}

export function firstNameFromFullName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "Member";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}
