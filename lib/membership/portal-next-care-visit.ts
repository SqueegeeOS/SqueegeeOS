import type { MemberAppointmentSummary } from "@/lib/member-intelligence/types";
import { parseTimeWindowFromNotes } from "@/lib/admin/schedule-membership-service";
import {
  formatMembershipCareVisitLabel,
  MEMBERSHIP_APPOINTMENT_TYPE,
} from "@/lib/membership/membership-appointment-types";
import type { SqueegeeKingTierId } from "@/lib/membership/tier-config";

export interface PortalNextCareVisit {
  hasScheduledVisit: boolean;
  /** Full date for detail views — e.g. "Friday, July 11, 2026" */
  dateLabel: string | null;
  /** Hero display — e.g. "July 11" */
  dateShortLabel: string | null;
  timeWindow: string | null;
  serviceTypeLabel: string;
  reassuranceCopy: string;
  /** Short hero line when a visit is scheduled */
  heroSupportCopy: string;
  emptyCopy: string;
}

const SCHEDULED_REASSURANCE =
  "Your next HomeAtlas care visit is scheduled. We'll arrive within the service window and update your property record after the visit.";

const HERO_SUPPORT =
  "Your home's next scheduled care visit is set.";

export function buildPortalNextCareVisit(input: {
  membershipActive: boolean;
  nextAppointment: MemberAppointmentSummary | null;
  cadence: SqueegeeKingTierId;
}): PortalNextCareVisit {
  const emptyCopy = input.membershipActive
    ? "Your next care visit is being scheduled."
    : "We're preparing your next care visit.";

  const defaultServiceLabel = formatMembershipCareVisitLabel(
    input.cadence,
    MEMBERSHIP_APPOINTMENT_TYPE,
  );

  const appointment = input.nextAppointment;
  if (!appointment || appointment.status !== "scheduled") {
    return {
      hasScheduledVisit: false,
      dateLabel: null,
      dateShortLabel: null,
      timeWindow: null,
      serviceTypeLabel: defaultServiceLabel,
      reassuranceCopy: "",
      heroSupportCopy: "",
      emptyCopy,
    };
  }

  const timeWindow = parseTimeWindowFromNotes(appointment.notes ?? null);
  const visitDate = new Date(appointment.date);

  return {
    hasScheduledVisit: true,
    dateLabel: visitDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }),
    dateShortLabel: visitDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }),
    timeWindow,
    serviceTypeLabel: formatMembershipCareVisitLabel(
      input.cadence,
      appointment.serviceType,
    ),
    reassuranceCopy: SCHEDULED_REASSURANCE,
    heroSupportCopy: HERO_SUPPORT,
    emptyCopy,
  };
}
