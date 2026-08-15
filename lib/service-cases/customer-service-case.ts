const SAFE_FRAGMENT_CHARACTER = /[^a-zA-Z0-9_-]/g;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const CUSTOMER_SERVICE_CASE_CATEGORIES = [
  "service_quality",
  "damage_concern",
  "access_issue",
  "billing_question",
  "scheduling_question",
  "other",
] as const;

export const CUSTOMER_SERVICE_CASE_STATUSES = [
  "open",
  "acknowledged",
  "resolved",
  "dismissed",
] as const;

export const CUSTOMER_SERVICE_CASE_ACTIONS = [
  "acknowledge",
  "resolve",
  "dismiss",
] as const;

export type CustomerServiceCaseCategory =
  (typeof CUSTOMER_SERVICE_CASE_CATEGORIES)[number];
export type CustomerServiceCaseStatus =
  (typeof CUSTOMER_SERVICE_CASE_STATUSES)[number];
export type CustomerServiceCaseAction =
  (typeof CUSTOMER_SERVICE_CASE_ACTIONS)[number];

export const CUSTOMER_SERVICE_CASE_CATEGORY_LABELS: Record<
  CustomerServiceCaseCategory,
  string
> = {
  service_quality: "Service quality",
  damage_concern: "Damage concern",
  access_issue: "Access or entry",
  billing_question: "Billing question",
  scheduling_question: "Scheduling question",
  other: "Something else",
};

export const CUSTOMER_SERVICE_CASE_STATUS_LABELS: Record<
  CustomerServiceCaseStatus,
  string
> = {
  open: "Received",
  acknowledged: "In review",
  resolved: "Resolved",
  dismissed: "Closed",
};

export interface CustomerServiceCasePortalView {
  id: string;
  category: CustomerServiceCaseCategory;
  details: string;
  status: CustomerServiceCaseStatus;
  appointmentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerServiceCaseAdminView
  extends CustomerServiceCasePortalView {
  membershipId: string;
  homeownerId: string;
  propertyId: string;
  homeownerName: string;
  propertyLabel: string;
  ownerNote: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value.trim());
}

export function isCustomerServiceCaseCategory(
  value: unknown,
): value is CustomerServiceCaseCategory {
  return (
    typeof value === "string" &&
    CUSTOMER_SERVICE_CASE_CATEGORIES.includes(
      value as CustomerServiceCaseCategory,
    )
  );
}

export function isCustomerServiceCaseAction(
  value: unknown,
): value is CustomerServiceCaseAction {
  return (
    typeof value === "string" &&
    CUSTOMER_SERVICE_CASE_ACTIONS.includes(value as CustomerServiceCaseAction)
  );
}

export function customerServiceCaseAnchorId(caseId: string): string {
  const normalized = caseId
    .trim()
    .replace(SAFE_FRAGMENT_CHARACTER, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `service-case-${normalized || "unknown"}`;
}

export function isOpenCustomerServiceCaseStatus(
  status: CustomerServiceCaseStatus,
): boolean {
  return status === "open" || status === "acknowledged";
}
