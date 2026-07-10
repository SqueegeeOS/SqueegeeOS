import type { MemberAppointmentSummary } from "@/lib/member-intelligence/types";
import { parseTimeWindowFromNotes } from "@/lib/admin/schedule-membership-service";
import {
  formatMembershipCareVisitLabel,
  MEMBERSHIP_APPOINTMENT_TYPE,
} from "@/lib/membership/membership-appointment-types";
import type { SqueegeeKingTierId } from "@/lib/membership/tier-config";

export interface PortalNextCareVisit {
  hasScheduledVisit: boolean;
  dateLabel: string | null;
  timeWindow: string | null;
  serviceTypeLabel: string;
  reassuranceCopy: string;
  emptyCopy: string;
}

const SCHEDULED_REASSURANCE =
  "Your next HomeAtlas care visit is scheduled. We'll arrive within the service window and update your property record after the visit.";

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
      timeWindow: null,
      serviceTypeLabel: defaultServiceLabel,
      reassuranceCopy: "",
      emptyCopy,
    };
  }

  const timeWindow = parseTimeWindowFromNotes(appointment.notes ?? null);

  return {
    hasScheduledVisit: true,
    dateLabel: new Date(appointment.date).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }),
    timeWindow,
    serviceTypeLabel: formatMembershipCareVisitLabel(
      input.cadence,
      appointment.serviceType,
    ),
    reassuranceCopy: SCHEDULED_REASSURANCE,
    emptyCopy,
  };
}
