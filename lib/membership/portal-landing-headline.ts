const PLACEHOLDER_NAMES = new Set(["member", "homeowner", "customer", "guest"]);

function normalizePersonalName(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (PLACEHOLDER_NAMES.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

function extractFirstNameFromFullName(fullName: string): string | null {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;

  if (parts.length === 1) {
    return normalizePersonalName(parts[0]);
  }

  const candidate = normalizePersonalName(parts[0]);
  if (!candidate) return null;
  if (candidate.length < 2) return null;
  if (/^[A-Z]\.?$/.test(candidate)) return null;

  return candidate;
}

/**
 * Portal hero — personal greeting without repeating the customer name.
 * Prefers: "Sylvia, your home is under care."
 */
export function buildPortalLandingHeadline(input: {
  firstName?: string | null;
  fullName?: string | null;
}): string {
  const fullName = normalizePersonalName(input.fullName);
  let firstName = normalizePersonalName(input.firstName);

  if (!firstName && fullName) {
    firstName = extractFirstNameFromFullName(fullName);
  }

  if (firstName) {
    return `${firstName}, your home is under care.`;
  }

  if (fullName) {
    return `${fullName} is under care.`;
  }

  return "Your home is under care.";
}
