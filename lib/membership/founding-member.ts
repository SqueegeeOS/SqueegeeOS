/**
 * Founding member cohort — granted at membership creation only.
 * Display later as: "Founding Member · Member since 2026"
 */

export interface FoundingMemberFields {
  foundingMember: boolean;
  foundingMemberSince: string | null;
}

/** Server env: ISO date — memberships created on or before this date are founding. Unset = open founding period. */
export function isFoundingMembershipPeriod(reference = new Date()): boolean {
  const endRaw = process.env.FOUNDING_PERIOD_END?.trim();
  if (!endRaw) return true;

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

export function formatFoundingMemberLabel(input: {
  foundingMember: boolean;
  memberSince: string | null;
}): string | null {
  if (!input.foundingMember) return null;

  const parsed = input.memberSince ? new Date(input.memberSince) : null;
  const year =
    parsed && !Number.isNaN(parsed.getTime())
      ? parsed.getFullYear()
      : new Date().getFullYear();

  return `Founding Member · Member since ${year}`;
}
