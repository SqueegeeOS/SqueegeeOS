export type MembershipVisitProgressStatus =
  | "scheduled"
  | "completed"
  | "cancelled"
  | "no_show";

export interface MembershipVisitProgressInput {
  id: string;
  scheduledAt: string;
  status: MembershipVisitProgressStatus;
  serviceLabel: string | null;
  timeWindow: string | null;
  source: "verified_jobber_appointment" | "paired_jobber_projection";
}

export interface MembershipPlanYear {
  startsAt: string;
  endsAt: string;
}

export interface MembershipAnnualVisitProgress {
  planYear: MembershipPlanYear;
  completed: number;
  scheduled: number;
  stillToBook: number | null;
  upcoming: MembershipVisitProgressInput[];
}

function validDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function anniversaryForYear(createdAt: Date, year: number): Date {
  const month = createdAt.getUTCMonth();
  const day = createdAt.getUTCDate();
  const result = new Date(
    Date.UTC(
      year,
      month,
      day,
      createdAt.getUTCHours(),
      createdAt.getUTCMinutes(),
      createdAt.getUTCSeconds(),
      createdAt.getUTCMilliseconds(),
    ),
  );

  // JavaScript rolls February 29 into March in non-leap years. Keep the
  // membership anniversary in February so plan years remain stable.
  if (result.getUTCMonth() !== month) {
    return new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
  }
  return result;
}

export function resolveCurrentMembershipPlanYear(
  membershipCreatedAt: string,
  referenceDate = new Date(),
): MembershipPlanYear {
  const createdAt = validDate(membershipCreatedAt) ?? referenceDate;
  let startsAt = anniversaryForYear(createdAt, referenceDate.getUTCFullYear());
  if (startsAt.getTime() > referenceDate.getTime()) {
    startsAt = anniversaryForYear(createdAt, referenceDate.getUTCFullYear() - 1);
  }
  const endsAt = anniversaryForYear(createdAt, startsAt.getUTCFullYear() + 1);
  return {
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  };
}

export function buildMembershipAnnualVisitProgress(input: {
  membershipCreatedAt: string;
  visitsPerYear: number | null;
  visits: MembershipVisitProgressInput[];
  referenceDate?: Date;
}): MembershipAnnualVisitProgress {
  const referenceDate = input.referenceDate ?? new Date();
  const planYear = resolveCurrentMembershipPlanYear(
    input.membershipCreatedAt,
    referenceDate,
  );
  const startsAt = new Date(planYear.startsAt).getTime();
  const endsAt = new Date(planYear.endsAt).getTime();
  const referenceTime = referenceDate.getTime();

  const visitsInPlanYear = input.visits.filter((visit) => {
    const scheduledAt = validDate(visit.scheduledAt)?.getTime();
    return scheduledAt != null && scheduledAt >= startsAt && scheduledAt < endsAt;
  });
  const completed = visitsInPlanYear.filter(
    (visit) => visit.status === "completed",
  ).length;
  const scheduled = visitsInPlanYear.filter(
    (visit) => visit.status === "scheduled",
  ).length;
  const required =
    typeof input.visitsPerYear === "number" && input.visitsPerYear > 0
      ? Math.floor(input.visitsPerYear)
      : null;

  return {
    planYear,
    completed,
    scheduled,
    stillToBook:
      required == null ? null : Math.max(required - completed - scheduled, 0),
    upcoming: input.visits
      .filter((visit) => {
        const scheduledAt = validDate(visit.scheduledAt)?.getTime();
        return (
          visit.status === "scheduled" &&
          scheduledAt != null &&
          scheduledAt >= referenceTime
        );
      })
      .sort(
        (left, right) =>
          new Date(left.scheduledAt).getTime() -
          new Date(right.scheduledAt).getTime(),
      ),
  };
}
