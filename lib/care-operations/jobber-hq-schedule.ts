export interface HqJobberPropertyLink {
  connection_id: string;
  external_property_id: string;
  property_id: string;
  membership_id: string;
}

export interface HqJobberVisitProjection {
  connection_id: string;
  external_property_id: string;
  external_visit_id: string;
  scheduled_start: string;
  scheduled_end: string | null;
  title: string | null;
  visit_status: string;
  is_complete: boolean;
}

function scheduledVisitStatus(value: string): boolean {
  const status = value.trim().toUpperCase();
  return !(
    status === "REMOVED" ||
    status.includes("CANCEL") ||
    /NO[ _-]?SHOW/.test(status) ||
    status.includes("COMPLETE")
  );
}

/**
 * Gives HQ the same read-only scheduling fallback as the member portal. An
 * exact active property link may show Jobber's next visit, but this helper does
 * not create a billing classification or mutate appointment authority.
 */
export function selectPairedJobberNextVisit(input: {
  membershipId: string;
  propertyId: string;
  propertyLinks: HqJobberPropertyLink[];
  projections: HqJobberVisitProjection[];
  referenceDate?: Date;
}): HqJobberVisitProjection | null {
  const link = input.propertyLinks.find(
    (candidate) =>
      candidate.membership_id === input.membershipId &&
      candidate.property_id === input.propertyId,
  );
  if (!link) return null;

  const referenceTime = (input.referenceDate ?? new Date()).getTime();
  return (
    input.projections
      .filter((projection) => {
        const scheduledTime = new Date(projection.scheduled_start).getTime();
        return (
          projection.connection_id === link.connection_id &&
          projection.external_property_id === link.external_property_id &&
          Number.isFinite(scheduledTime) &&
          scheduledTime >= referenceTime &&
          !projection.is_complete &&
          scheduledVisitStatus(projection.visit_status)
        );
      })
      .sort(
        (left, right) =>
          new Date(left.scheduled_start).getTime() -
          new Date(right.scheduled_start).getTime(),
      )[0] ?? null
  );
}
