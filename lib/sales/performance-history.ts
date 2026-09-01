import {
  formatBusinessCalendarDate,
  zonedDateTimeToUtc,
} from "@/lib/admin/company-business-timezone";
import type {
  SalesPerformanceDay,
  SalesPerformanceHistory,
} from "./workspace-types";

export const SALES_PERFORMANCE_WINDOW_DAYS = 30;

interface ActivityEvent {
  event_type: string;
  quantity: number;
  occurred_at: string;
}

interface AttributionEvent {
  qualification_status: "pending" | "active" | "qualified" | "cancelled";
  attributed_arr_cents: number;
  attributed_at: string;
}

function shiftCalendarDate(calendarDate: string, days: number): string {
  const [year, month, day] = calendarDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

function percent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function getSalesPerformanceStartUtc(
  referenceDate: Date,
  rangeDays = SALES_PERFORMANCE_WINDOW_DAYS,
): Date {
  const today = formatBusinessCalendarDate(referenceDate);
  return zonedDateTimeToUtc(shiftCalendarDate(today, -(rangeDays - 1)), 0, 0, 0);
}

export function buildSalesPerformanceHistory(input: {
  referenceDate: Date;
  activities: ActivityEvent[];
  leadCreatedAt: string[];
  attributions: AttributionEvent[];
  rangeDays?: number;
}): SalesPerformanceHistory {
  const rangeDays = Math.max(1, input.rangeDays ?? SALES_PERFORMANCE_WINDOW_DAYS);
  const today = formatBusinessCalendarDate(input.referenceDate);
  const days = Array.from({ length: rangeDays }, (_, index) => {
    const date = shiftCalendarDate(today, index - (rangeDays - 1));
    return {
      date,
      doors: 0,
      homeownersTalkedTo: 0,
      presentations: 0,
      leads: 0,
      wins: 0,
      closedArrCents: 0,
    } satisfies SalesPerformanceDay;
  });
  const byDate = new Map(days.map((day) => [day.date, day]));

  for (const activity of input.activities) {
    const occurredAt = new Date(activity.occurred_at);
    if (Number.isNaN(occurredAt.getTime())) continue;
    const day = byDate.get(formatBusinessCalendarDate(occurredAt));
    if (!day) continue;
    const quantity = Number(activity.quantity) || 0;
    if (activity.event_type === "door_knock") day.doors += quantity;
    if (activity.event_type === "conversation") {
      day.homeownersTalkedTo += quantity;
    }
    if (activity.event_type === "presentation_started") {
      day.presentations += quantity;
    }
  }

  for (const createdAtValue of input.leadCreatedAt) {
    const createdAt = new Date(createdAtValue);
    if (Number.isNaN(createdAt.getTime())) continue;
    const day = byDate.get(formatBusinessCalendarDate(createdAt));
    if (day) day.leads += 1;
  }

  for (const attribution of input.attributions) {
    if (attribution.qualification_status === "cancelled") continue;
    const attributedAt = new Date(attribution.attributed_at);
    if (Number.isNaN(attributedAt.getTime())) continue;
    const day = byDate.get(formatBusinessCalendarDate(attributedAt));
    if (!day) continue;
    day.wins += 1;
    day.closedArrCents += Number(attribution.attributed_arr_cents) || 0;
  }

  const totals = days.reduce<Omit<SalesPerformanceDay, "date">>(
    (sum, day) => ({
      doors: sum.doors + day.doors,
      homeownersTalkedTo: sum.homeownersTalkedTo + day.homeownersTalkedTo,
      presentations: sum.presentations + day.presentations,
      leads: sum.leads + day.leads,
      wins: sum.wins + day.wins,
      closedArrCents: sum.closedArrCents + day.closedArrCents,
    }),
    {
      doors: 0,
      homeownersTalkedTo: 0,
      presentations: 0,
      leads: 0,
      wins: 0,
      closedArrCents: 0,
    },
  );

  return {
    rangeDays,
    days,
    totals,
    conversationRatePercent: percent(totals.homeownersTalkedTo, totals.doors),
    presentationRatePercent: percent(
      totals.presentations,
      totals.homeownersTalkedTo,
    ),
    closeRatePercent: percent(totals.wins, totals.presentations),
  };
}
