const SAFE_FRAGMENT_CHARACTER = /[^a-zA-Z0-9_-]/g;

export function billingMembershipAnchorId(membershipId: string): string {
  const normalized = membershipId
    .trim()
    .replace(SAFE_FRAGMENT_CHARACTER, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
  return `billing-${normalized || "unknown"}`;
}
