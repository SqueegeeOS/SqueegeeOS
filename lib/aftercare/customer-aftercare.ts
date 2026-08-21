import {
  formatBusinessCalendarDate,
  zonedDateTimeToUtc,
} from "@/lib/admin/company-business-timezone";
import type { CustomerServiceCaseAdminView } from "@/lib/service-cases/customer-service-case";

const SAFE_FRAGMENT_CHARACTER = /[^a-zA-Z0-9_-]/g;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const REVIEW_OPPORTUNITY_READY_MS = 24 * 60 * 60 * 1_000;
export const REVIEW_OPPORTUNITY_WINDOW_MS = 21 * 24 * 60 * 60 * 1_000;
export const ANNUAL_CHECKIN_LOOKAHEAD_MS = 30 * 24 * 60 * 60 * 1_000;
export const ANNUAL_CHECKIN_OVERDUE_WINDOW_MS = 60 * 24 * 60 * 60 * 1_000;

export type CustomerAftercareTaskType =
  | "review_opportunity"
  | "annual_care_checkin";
export type CustomerAftercareOutcome =
  | "review_requested"
  | "already_reviewed"
  | "not_appropriate"
  | "checkin_completed"
  | "not_needed";
export type CustomerAftercareResolution = "completed" | "dismissed";

interface CustomerAftercareTaskBase {
  taskKey: string;
  type: CustomerAftercareTaskType;
  homeownerId: string;
  propertyId: string;
  membershipId: string;
  homeownerName: string;
  propertyLabel: string;
  dueAt: string;
  evidenceAt: string;
}

export interface ReviewOpportunityTask extends CustomerAftercareTaskBase {
  type: "review_opportunity";
  appointmentId: string;
  serviceLabel: string;
  completedAt: string;
  customerSummaryVisible: boolean;
  customerPhotoVisible: boolean;
}

export interface AnnualCareCheckinTask extends CustomerAftercareTaskBase {
  type: "annual_care_checkin";
  appointmentId: null;
  membershipStartedAt: string;
  anniversaryNumber: number;
}

export type CustomerAftercareTask =
  | ReviewOpportunityTask
  | AnnualCareCheckinTask;

export interface CustomerAftercareSnapshot {
  generatedAt: string;
  serviceCases: CustomerServiceCaseAdminView[];
  tasks: CustomerAftercareTask[];
  truncated: boolean;
  reviewAutomation?: {
    state:
      | "active"
      | "off"
      | "waiting_for_twilio"
      | "waiting_for_review_link"
      | "not_installed";
    installed: boolean;
    enabled: boolean;
    twilioConfigured: boolean;
    twilioReady: boolean;
    reviewLinkReady: boolean;
    detail: string;
  };
}

export interface AnnualCareCheckinOpportunity {
  taskKey: string;
  dueAt: string;
  anniversaryNumber: number;
}

export function reviewOpportunityTaskKey(appointmentId: string): string | null {
  const id = appointmentId.trim();
  return UUID_PATTERN.test(id) ? `review-opportunity:${id.toLowerCase()}` : null;
}

export function annualCareCheckinTaskKey(
  membershipId: string,
  anniversaryYear: number,
): string | null {
  const id = membershipId.trim();
  if (!UUID_PATTERN.test(id) || !Number.isInteger(anniversaryYear)) return null;
  if (anniversaryYear < 2000 || anniversaryYear > 9999) return null;
  return `annual-care-checkin:${id.toLowerCase()}:${anniversaryYear}`;
}

export function customerAftercareTaskAnchorId(taskKey: string): string {
  const normalized = taskKey
    .trim()
    .replace(SAFE_FRAGMENT_CHARACTER, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
  return `aftercare-task-${normalized || "unknown"}`;
}

export function isReviewOpportunityReady(
  completedAt: string,
  now: Date,
): boolean {
  const completed = Date.parse(completedAt);
  if (!Number.isFinite(completed)) return false;
  const age = now.getTime() - completed;
  return (
    age >= REVIEW_OPPORTUNITY_READY_MS &&
    age <= REVIEW_OPPORTUNITY_WINDOW_MS
  );
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function annualCalendarDate(
  year: number,
  startMonth: number,
  startDay: number,
): string {
  const day = Math.min(startDay, lastDayOfMonth(year, startMonth));
  return `${year}-${String(startMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function annualCareCheckinOpportunity(input: {
  membershipId: string;
  membershipStartedAt: string;
  now: Date;
}): AnnualCareCheckinOpportunity | null {
  const started = new Date(input.membershipStartedAt);
  if (!Number.isFinite(started.getTime())) return null;
  const startDate = formatBusinessCalendarDate(started);
  const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
  const currentYear = Number(formatBusinessCalendarDate(input.now).slice(0, 4));

  const eligible = [currentYear - 1, currentYear, currentYear + 1]
    .map((anniversaryYear) => {
      const anniversaryNumber = anniversaryYear - startYear;
      if (anniversaryNumber < 1) return null;
      const dueAt = zonedDateTimeToUtc(
        annualCalendarDate(anniversaryYear, startMonth, startDay),
        9,
        0,
        0,
      );
      const taskKey = annualCareCheckinTaskKey(
        input.membershipId,
        anniversaryYear,
      );
      if (!taskKey) return null;
      const distance = dueAt.getTime() - input.now.getTime();
      if (
        distance > ANNUAL_CHECKIN_LOOKAHEAD_MS ||
        distance < -ANNUAL_CHECKIN_OVERDUE_WINDOW_MS
      ) {
        return null;
      }
      return {
        taskKey,
        dueAt: dueAt.toISOString(),
        anniversaryNumber,
        absoluteDistance: Math.abs(distance),
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .sort((left, right) => left.absoluteDistance - right.absoluteDistance);

  const opportunity = eligible[0];
  return opportunity
    ? {
        taskKey: opportunity.taskKey,
        dueAt: opportunity.dueAt,
        anniversaryNumber: opportunity.anniversaryNumber,
      }
    : null;
}

export function isCustomerAftercareOutcome(
  value: unknown,
): value is CustomerAftercareOutcome {
  return (
    value === "review_requested" ||
    value === "already_reviewed" ||
    value === "not_appropriate" ||
    value === "checkin_completed" ||
    value === "not_needed"
  );
}

export function outcomeMatchesAftercareTask(
  type: CustomerAftercareTaskType,
  outcome: CustomerAftercareOutcome,
): boolean {
  return type === "review_opportunity"
    ? outcome === "review_requested" ||
        outcome === "already_reviewed" ||
        outcome === "not_appropriate"
    : outcome === "checkin_completed" || outcome === "not_needed";
}

export function resolutionForAftercareOutcome(
  outcome: CustomerAftercareOutcome,
): CustomerAftercareResolution {
  return outcome === "not_appropriate" || outcome === "not_needed"
    ? "dismissed"
    : "completed";
}
