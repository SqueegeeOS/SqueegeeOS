import type { JobberTodayVisit } from "@/lib/care-operations/jobber-today-types";

export interface FieldUpcomingVisit {
  id: string;
  clientName: string;
  service: string;
  scheduledStart: string;
  scheduledEnd: string | null;
  address: string | null;
}

/** Input must already be scoped to the authenticated technician on the server. */
export function fieldUpcomingVisits(visits: JobberTodayVisit[], tomorrow: Date): FieldUpcomingVisit[] {
  return visits.filter(visit => !visit.isComplete && visit.visitStatus !== "REMOVED" &&
    Date.parse(visit.scheduledStart) >= tomorrow.getTime())
    .sort((a, b) => Date.parse(a.scheduledStart) - Date.parse(b.scheduledStart))
    .map(visit => ({ id: visit.projectionId, clientName: visit.clientName,
      service: visit.title || "Scheduled service", scheduledStart: visit.scheduledStart,
      scheduledEnd: visit.scheduledEnd, address: visit.propertyLabel }));
}
