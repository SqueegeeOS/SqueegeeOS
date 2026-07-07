/**
 * Founding member cohort — granted at membership creation only.
 * Permanent: tied to founding_member on the row, not membership status.
 */

export interface FoundingMemberFields {
  foundingMember: boolean;
  foundingMemberSince: string | null;
}

export interface FoundingMemberDisplay {
  title: string;
  story: string;
  memberSinceLine: string;
}

/** Shared story line — the home, not just the member. */
export const FOUNDING_MEMBER_STORY =
  "One of the original homes entrusted to the HomeAtlas Care Network.";

/** Care-record opening line for a founding home (property-centric). */
export const FOUNDING_HOME_PROLOGUE =
  "This property became one of the original homes entrusted to the HomeAtlas Care Network.";

/**
 * Future care-record line when ownership changes (property stewardship, not owner):
 * "This property entered the HomeAtlas Care Network in {year} as a Founding Home."
 */

let hasWarnedOpenFoundingPeriod = false;

function warnOpenFoundingPeriodInProduction(): void {
  if (hasWarnedOpenFoundingPeriod) return;
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.FOUNDING_PERIOD_END?.trim()) return;

  hasWarnedOpenFoundingPeriod = true;
  console.warn(
    "[founding-member] FOUNDING_PERIOD_END is not set — all new memberships receive founding status until this env is configured",
  );
}

/** Server env: ISO date — memberships created on or before this date are founding. Unset = open founding period. */
export function isFoundingMembershipPeriod(reference = new Date()): boolean {
  const endRaw = process.env.FOUNDING_PERIOD_END?.trim();
  if (!endRaw) {
    warnOpenFoundingPeriodInProduction();
    return true;
  }

  const end = new Date(endRaw);
  if (Number.isNaN(end.getTime())) return true;

  return reference.getTime() <= end.getTime();
}

export function resolveFoundingMemberFields(
  memberSinceIso: string,
): FoundingMemberFields {
  const memberSince = new Date(memberSinceIso);
  if (Number.isNaN(memberSince.getTime()) || !isFoundingMembershipPeriod(memberSince)) {
    return { foundingMember: false, foundingMemberSince: null };
  }

  return {
    foundingMember: true,
    foundingMemberSince: memberSinceIso,
  };
}

function resolveMemberSinceYear(memberSince: string | null): number {
  const parsed = memberSince ? new Date(memberSince) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) {
    return parsed.getFullYear();
  }
  return new Date().getFullYear();
}

export function resolveFoundingMemberDisplay(
  portalData: {
    foundingMember: boolean;
    memberSince: string | null;
  } | null | undefined,
): FoundingMemberDisplay | null {
  if (!portalData?.foundingMember) return null;

  const year = resolveMemberSinceYear(portalData.memberSince);

  return {
    title: "Founding Member",
    story: FOUNDING_MEMBER_STORY,
    memberSinceLine: `Member Since ${year}`,
  };
}

/** @deprecated Use resolveFoundingMemberDisplay for portal UI */
export function formatFoundingMemberLabel(input: {
  foundingMember: boolean;
  memberSince: string | null;
}): string | null {
  const display = resolveFoundingMemberDisplay(
    input.foundingMember
      ? { foundingMember: true, memberSince: input.memberSince }
      : null,
  );
  if (!display) return null;
  return `${display.title} · ${display.memberSinceLine.replace("Member Since ", "Member since ")}`;
}

/** @deprecated Use resolveFoundingMemberDisplay */
export function resolveFoundingMemberLabel(
  portalData: {
    foundingMember: boolean;
    memberSince: string | null;
  } | null | undefined,
): string | null {
  const display = resolveFoundingMemberDisplay(portalData);
  if (!display) return null;
  return formatFoundingMemberLabel({
    foundingMember: true,
    memberSince: portalData?.memberSince ?? null,
  });
}
