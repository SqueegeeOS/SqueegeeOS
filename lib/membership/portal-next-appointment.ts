import type { MemberAppointmentSummary } from "@/lib/member-intelligence/types";
import { getBusinessCalendarDayUtcBounds } from "@/lib/admin/company-business-timezone";

function appointmentTime(appointment: MemberAppointmentSummary): number | null {
  const time = new Date(appointment.date).getTime();
  return Number.isFinite(time) ? time : null;
}

/**
 * A visit remains the member's "next visit" for its entire Chico business day.
 * Jobber is responsible for changing the status after completion or cancellation;
 * a stale scheduled visit from a prior day must never be presented as upcoming.
 */
export function selectNextScheduledPortalAppointment(
  appointments: MemberAppointmentSummary[],
  referenceDate: Date = new Date(),
): MemberAppointmentSummary | null {
  const { startUtc } = getBusinessCalendarDayUtcBounds(referenceDate);
  const lowerBound = startUtc.getTime();

  return (
    appointments
      .filter((appointment) => {
        const time = appointmentTime(appointment);
        return (
          appointment.status === "scheduled" &&
          time !== null &&
          time >= lowerBound
        );
      })
      .sort(
        (left, right) =>
          (appointmentTime(left) ?? Number.MAX_SAFE_INTEGER) -
          (appointmentTime(right) ?? Number.MAX_SAFE_INTEGER),
      )[0] ?? null
  );
}

export function portalAppointmentLowerBoundIso(
  referenceDate: Date = new Date(),
): string {
  return getBusinessCalendarDayUtcBounds(referenceDate).startUtc.toISOString();
}
