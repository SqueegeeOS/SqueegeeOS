/** Shared yearly membership value — same formula as /hq/memberships. */
export function computeMembershipYearlyValue(member: {
  annual_rate: number | null;
  visit_price: number | null;
  visits_per_year: number | null;
}): number | null {
  if (typeof member.annual_rate === "number" && member.annual_rate > 0) {
    return member.annual_rate;
  }
  if (
    typeof member.visit_price === "number" &&
    typeof member.visits_per_year === "number"
  ) {
    return member.visit_price * member.visits_per_year;
  }
  return null;
}
