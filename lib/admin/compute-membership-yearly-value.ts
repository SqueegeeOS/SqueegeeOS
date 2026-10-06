export interface RecurringMembershipValueRow {
  status: string;
  annual_value_cents: number | null;
}

export interface MembershipYearlyValueInput {
  annual_rate: number | null;
  visit_price: number | null;
  visits_per_year: number | null;
  recurring_services?: RecurringMembershipValueRow[] | null;
}

/** Planning value only: signed base plan plus active recurring additions.
 * Never use this combined value as billing authorization or a charge amount.
 */
export function computeMembershipYearlyValue(
  member: MembershipYearlyValueInput,
): number | null {
  let base: number | null = null;
  if (typeof member.annual_rate === "number" && member.annual_rate > 0) {
    base = member.annual_rate;
  } else if (
    typeof member.visit_price === "number" &&
    typeof member.visits_per_year === "number"
  ) {
    base = member.visit_price * member.visits_per_year;
  }
  if (base == null) return null;

  const additionalCents = (member.recurring_services ?? []).reduce(
    (sum, service) => {
      const value = service.annual_value_cents;
      return service.status === "active" &&
        typeof value === "number" && Number.isFinite(value) && value > 0
        ? sum + value
        : sum;
    },
    0,
  );
  return (Math.round(base * 100) + additionalCents) / 100;
}
