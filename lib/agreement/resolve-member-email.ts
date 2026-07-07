const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return EMAIL_PATTERN.test(trimmed) ? trimmed : null;
}

export function resolveMemberEmail(
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const candidate of candidates) {
    const normalized = normalizeEmail(candidate);
    if (normalized) return normalized;
  }
  return null;
}
