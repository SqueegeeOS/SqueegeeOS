import { getBusinessCalendarDayUtcBounds } from "@/lib/admin/company-business-timezone";
import type {
  TechnicianVisitEventSnapshot,
  TechnicianVisitEventType,
} from "@/lib/field-operations/technician-visit-events";
import { technicianVisitStageProgress } from "@/lib/field-operations/technician-visit-events";
import type { MemberAppointmentSummary } from "@/lib/member-intelligence/types";
import { formatServiceTypeLabel } from "@/lib/membership/service-labels";

export interface PortalLiveServiceStatus {
  stage: TechnicianVisitEventType;
  statusLabel: string;
  headline: string;
  support: string;
  serviceTypeLabel: string;
  scheduledAt: string;
  updatedAt: string;
  progress: {
    completed: number;
    total: number;
  };
}

interface PortalLiveServiceCandidate {
  appointment: MemberAppointmentSummary;
  snapshot: TechnicianVisitEventSnapshot;
  updatedAtMs: number;
}

const CUSTOMER_COPY: Record<
  TechnicianVisitEventType,
  Pick<PortalLiveServiceStatus, "statusLabel" | "headline" | "support">
> = {
  en_route: {
    statusLabel: "On the way",
    headline: "Your SqueegeeKing team is on the way.",
    support: "We are heading to your home for today's scheduled care.",
  },
  arrived: {
    statusLabel: "Arrived",
    headline: "Your SqueegeeKing team has arrived.",
    support: "Your scheduled home service is ready to begin.",
  },
  service_started: {
    statusLabel: "Service in progress",
    headline: "Your home service is in progress.",
    support: "Your team is caring for your property now.",
  },
  service_completed: {
    statusLabel: "Service complete",
    headline: "Today's service is complete.",
    support:
      "Approved visit notes and photos will appear in HomeAtlas as they are finalized.",
  },
  departed: {
    statusLabel: "Visit complete",
    headline: "Today's visit is all wrapped up.",
    support: "Your SqueegeeKing team has finished and left your property.",
  },
};

function validInstant(value: string | null): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function isAppointmentEligibleForLiveService(
  appointment: MemberAppointmentSummary,
  startMs: number,
  endMs: number,
): boolean {
  if (appointment.status === "cancelled" || appointment.status === "no_show") {
    return false;
  }
  const scheduledAt = validInstant(appointment.date);
  return scheduledAt !== null && scheduledAt >= startMs && scheduledAt < endMs;
}

/**
 * Returns only appointment IDs that are already property-scoped by the caller
 * and scheduled on the current company calendar day.
 */
export function portalLiveServiceAppointmentIds(
  appointments: MemberAppointmentSummary[],
  referenceDate: Date = new Date(),
): string[] {
  const { startUtc, endUtc } = getBusinessCalendarDayUtcBounds(referenceDate);
  const startMs = startUtc.getTime();
  const endMs = endUtc.getTime();
  return appointments
    .filter((appointment) =>
      isAppointmentEligibleForLiveService(appointment, startMs, endMs),
    )
    .map((appointment) => appointment.id);
}

/**
 * Projects internal field events into the deliberately small, customer-safe
 * shape used by the portal. Actor identity, provider IDs, route data, access
 * grants, internal notes, and customer-alert drafts never enter the result.
 */
export function buildPortalLiveServiceStatus(input: {
  appointments: MemberAppointmentSummary[];
  snapshotsByAppointmentId: Map<string, TechnicianVisitEventSnapshot>;
  referenceDate?: Date;
}): PortalLiveServiceStatus | null {
  const referenceDate = input.referenceDate ?? new Date();
  const { startUtc, endUtc } = getBusinessCalendarDayUtcBounds(referenceDate);
  const startMs = startUtc.getTime();
  const endMs = endUtc.getTime();

  const candidates = input.appointments.flatMap(
    (appointment): PortalLiveServiceCandidate[] => {
      if (!isAppointmentEligibleForLiveService(appointment, startMs, endMs)) {
        return [];
      }
      const snapshot = input.snapshotsByAppointmentId.get(appointment.id);
      if (!snapshot || snapshot.stage === "not_started") return [];
      const updatedAtMs = validInstant(snapshot.occurredAt);
      if (
        updatedAtMs === null ||
        updatedAtMs < startMs ||
        updatedAtMs >= endMs
      ) {
        return [];
      }
      return [{ appointment, snapshot, updatedAtMs }];
    },
  );

  const current = candidates.sort(
    (left, right) => right.updatedAtMs - left.updatedAtMs,
  )[0];
  if (!current || current.snapshot.stage === "not_started") return null;

  const stage = current.snapshot.stage;
  const copy = CUSTOMER_COPY[stage];
  return {
    stage,
    ...copy,
    serviceTypeLabel: formatServiceTypeLabel(
      current.appointment.serviceType,
    ),
    scheduledAt: current.appointment.date,
    updatedAt: current.snapshot.occurredAt!,
    progress: technicianVisitStageProgress(stage),
  };
}
