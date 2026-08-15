const SAFE_FRAGMENT_CHARACTER = /[^a-zA-Z0-9_-]/g;

function safeFragment(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .replace(SAFE_FRAGMENT_CHARACTER, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.slice(0, 180) || fallback;
}

export function jobberTodayVisitAnchorId(projectionId: string): string {
  return `visit-${safeFragment(projectionId, "unknown")}`;
}

export function visitFieldFollowUpAnchorId(assessmentId: string): string {
  return `field-follow-up-${safeFragment(assessmentId, "unknown")}`;
}

export function technicianFieldPassAnchorId(jobberUserId: string): string {
  return `field-pass-${safeFragment(jobberUserId, "unknown")}`;
}
