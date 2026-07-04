import type { MemberAppointmentSummary } from "@/lib/member-intelligence/types";
import { formatServiceTypeLabel } from "./service-labels";
import type {
  MembershipTierId,
  ServiceScheduleStatus,
  TierServiceDefinition,
} from "./tier-config";
import { servicesForTier } from "./tier-config";

export interface ScheduledServiceItem {
  id: string;
  serviceId: string;
  label: string;
  monthLabel: string;
  scheduledDate: string | null;
  status: ServiceScheduleStatus;
  technician?: string | null;
}

export interface MemberScheduleView {
  tier: MembershipTierId;
  items: ScheduledServiceItem[];
  nextVisit: ScheduledServiceItem | null;
  completedCount: number;
  yearToDateInvested: number;
  ytdSavings?: number;
  totalSaved?: number;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

function quarterlyMonths(): number[] {
  return [0, 3, 6, 9];
}

function biAnnualMonths(): number[] {
  return [2, 8];
}

function assignMonths(
  service: TierServiceDefinition,
): Array<{ month: number; label: string }> {
  const count = service.visitsPerYear;
  let monthIndexes: number[] = [];

  switch (service.frequency) {
    case "quarterly":
    case "every_visit":
      monthIndexes = quarterlyMonths().slice(0, count);
      break;
    case "bi_annual":
      monthIndexes = biAnnualMonths().slice(0, count);
      break;
    case "annual":
    case "addon":
      monthIndexes = [service.id.includes("interior") ? 10 : 2];
      break;
    default:
      monthIndexes = [5];
  }

  return monthIndexes.map((m) => ({
    month: m,
    label: `${MONTHS[m]} ${service.shortLabel}`,
  }));
}

function isoForMonth(year: number, month: number, day = 14): string {
  const d = new Date(year, month, day);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Builds a demo annual schedule with realistic completed / upcoming states.
 * Production: replace with member_appointments rows from Supabase.
 */
export function buildMemberAnnualSchedule(options: {
  tier: MembershipTierId;
  year?: number;
  referenceDate?: Date;
  monthlyPrice: number;
  dedicatedTech?: string | null;
}): MemberScheduleView {
  const year = options.year ?? new Date().getFullYear();
  const now = options.referenceDate ?? new Date();
  const services = servicesForTier(options.tier);
  const items: ScheduledServiceItem[] = [];

  for (const service of services) {
    const slots = assignMonths(service);
    slots.forEach((slot, index) => {
      const slotDate = new Date(year, slot.month, 14);
      let status: ServiceScheduleStatus = "pending";
      if (slotDate < now) {
        status = "completed";
      } else if (
        !items.some((i) => i.status === "scheduled") &&
        slotDate >= now
      ) {
        status = "scheduled";
      }

      items.push({
        id: `${service.id}-${year}-${index}`,
        serviceId: service.id,
        label: slot.label,
        monthLabel: MONTHS[slot.month],
        scheduledDate:
          status === "pending" && slotDate < now
            ? null
            : isoForMonth(year, slot.month),
        status,
        technician:
          status === "scheduled"
            ? options.dedicatedTech ?? "Your care team"
            : null,
      });
    });
  }

  items.sort((a, b) => {
    const order = { completed: 0, scheduled: 1, pending: 2 };
    return order[a.status] - order[b.status];
  });

  const nextVisit = items.find((i) => i.status === "scheduled") ?? null;
  const completedCount = items.filter((i) => i.status === "completed").length;
  const monthsElapsed = Math.max(1, now.getMonth() + 1);
  const yearToDateInvested = Math.round(
    options.monthlyPrice * Math.min(monthsElapsed, 12),
  );

  return {
    tier: options.tier,
    items,
    nextVisit,
    completedCount,
    yearToDateInvested,
  };
}

function formatScheduleDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function mapAppointmentStatus(
  status: MemberAppointmentSummary["status"],
  scheduledAt: string,
  referenceDate: Date,
): ServiceScheduleStatus {
  if (status === "completed") return "completed";
  if (status === "scheduled") {
    return new Date(scheduledAt) >= referenceDate ? "scheduled" : "pending";
  }
  return "pending";
}

/**
 * Builds portal schedule from live member_appointments rows.
 */
export function buildScheduleFromAppointments(options: {
  appointments: MemberAppointmentSummary[];
  monthlyPrice: number;
  referenceDate?: Date;
  ytdSavings?: number;
}): MemberScheduleView {
  const now = options.referenceDate ?? new Date();
  const year = now.getFullYear();

  const items: ScheduledServiceItem[] = options.appointments.map((appt) => {
    const date = new Date(appt.date);
    const status = mapAppointmentStatus(appt.status, appt.date, now);
    const monthLabel = date.toLocaleDateString("en-US", { month: "short" });

    return {
      id: appt.id,
      serviceId: appt.serviceType,
      label: formatServiceTypeLabel(appt.serviceType),
      monthLabel,
      scheduledDate: formatScheduleDate(appt.date),
      status,
      technician: appt.technician,
    };
  });

  items.sort((a, b) => {
    const order = { completed: 0, scheduled: 1, pending: 2 };
    return order[a.status] - order[b.status];
  });

  const nextVisit = items.find((i) => i.status === "scheduled") ?? null;
  const completedCount = items.filter(
    (i) =>
      i.status === "completed" &&
      i.scheduledDate?.includes(String(year)),
  ).length;

  const monthsElapsed = Math.max(1, now.getMonth() + 1);
  const yearToDateInvested = Math.round(
    options.monthlyPrice * Math.min(monthsElapsed, 12),
  );

  return {
    tier: "premium" as MembershipTierId,
    items,
    nextVisit,
    completedCount,
    yearToDateInvested,
    ytdSavings: options.ytdSavings,
  };
}
