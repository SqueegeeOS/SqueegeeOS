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
  external_job_id: string;
  scheduled_start: string;
  scheduled_end: string | null;
  title: string | null;
  visit_status: string;
  is_complete: boolean;
}

export interface HqJobberMembershipJobLink {
  connection_id: string;
  external_job_id: string;
  external_property_id: string;
  membership_id: string;
  property_id: string;
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
 * A property pairing establishes customer identity, not membership service
 * scope. Only Jobber jobs explicitly linked to the membership may consume its
 * contracted visit slots; other work at the property remains separate add-on
 * work.
 */
export function selectLinkedMembershipJobberVisits(input: {
  membershipId: string;
  propertyId: string;
  propertyLinks: HqJobberPropertyLink[];
  membershipJobLinks: HqJobberMembershipJobLink[];
  projections: HqJobberVisitProjection[];
}): HqJobberVisitProjection[] {
  const propertyLink = input.propertyLinks.find(
    (candidate) =>
      candidate.membership_id === input.membershipId &&
      candidate.property_id === input.propertyId,
  );
  if (!propertyLink) return [];

  const linkedJobIds = new Set(
    input.membershipJobLinks
      .filter(
        (candidate) =>
          candidate.membership_id === input.membershipId &&
          candidate.property_id === input.propertyId &&
          candidate.connection_id === propertyLink.connection_id &&
          candidate.external_property_id === propertyLink.external_property_id,
      )
      .map((candidate) => candidate.external_job_id),
  );

  return input.projections.filter(
    (projection) =>
      projection.connection_id === propertyLink.connection_id &&
      projection.external_property_id === propertyLink.external_property_id &&
      linkedJobIds.has(projection.external_job_id),
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
  membershipJobLinks: HqJobberMembershipJobLink[];
  projections: HqJobberVisitProjection[];
  referenceDate?: Date;
}): HqJobberVisitProjection | null {
  const referenceTime = (input.referenceDate ?? new Date()).getTime();
  return (
    selectLinkedMembershipJobberVisits(input)
      .filter((projection) => {
        const scheduledTime = new Date(projection.scheduled_start).getTime();
        return (
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
