export interface ParsedClientAddress {
  address: string;
  city: string;
  state: string;
  zip: string;
  propertyName: string;
}

const STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  "district of columbia": "DC",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const STATE_TOKEN_PATTERN = [
  ...Object.keys(STATE_NAME_TO_CODE)
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp),
  "[A-Za-z]{2}",
].join("|");

// Accept state abbreviations or full state names, with or without the comma
// before the state. ZIP+4 may use a normal hyphen, whitespace, or a typographic
// dash. The stored state and ZIP are always canonicalized.
const STATE_ZIP_PATTERN = new RegExp(
  `(?:,|\\s)\\s*(${STATE_TOKEN_PATTERN})\\s+(\\d{5})(?:[-\\s‐‑‒–—―−]?(\\d{4}))?\\s*$`,
  "i",
);

/**
 * Best-effort parse of a single-line client address from presentations.
 * Preserves missing components as empty strings. Callers that create an
 * authoritative property must reject incomplete addresses rather than invent
 * a city or state.
 */
export function parseClientAddress(
  raw: string,
  fallbackName?: string,
): ParsedClientAddress {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      address: fallbackName?.trim() || "Property",
      city: "",
      state: "",
      zip: "",
      propertyName: fallbackName?.trim() || "Property",
    };
  }

  const stateZipMatch = trimmed.match(STATE_ZIP_PATTERN);
  if (!stateZipMatch) {
    return {
      address: trimmed,
      city: "",
      state: "",
      zip: "",
      propertyName: fallbackName?.trim() || trimmed,
    };
  }

  const stateToken = stateZipMatch[1].trim().toLowerCase();
  const state =
    STATE_NAME_TO_CODE[stateToken] ?? stateZipMatch[1].toUpperCase();
  const zip = stateZipMatch[3]
    ? `${stateZipMatch[2]}-${stateZipMatch[3]}`
    : stateZipMatch[2];
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
    city: "",
    state,
    zip,
    propertyName: fallbackName?.trim() || beforeState,
  };
}

export function hasCompleteClientAddress(
  address: ParsedClientAddress,
): boolean {
  return Boolean(
    address.address.trim() &&
      address.city.trim() &&
      /^[A-Z]{2}$/.test(address.state) &&
      /^\d{5}(?:-\d{4})?$/.test(address.zip),
  );
}

export function firstNameFromFullName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "Member";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}
