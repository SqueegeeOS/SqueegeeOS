export interface TechnicianJobAddonReport {
  id: string;
  assignmentId: string;
  serviceName: string;
  reportedAmountCents: number;
  reportedAt: string;
  voidedAt: string | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isJobAddonAssignmentId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function validateTechnicianJobAddonRequest(value: unknown):
  | { clientRequestId: string; assignmentId: string; serviceName: string; reportedAmountCents: number }
  | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const serviceName = typeof input.serviceName === "string" ? input.serviceName.trim() : "";
  if (!isJobAddonAssignmentId(input.clientRequestId) ||
      !isJobAddonAssignmentId(input.assignmentId) ||
      serviceName.length < 2 || serviceName.length > 120 ||
      typeof input.reportedAmountCents !== "number" ||
      !Number.isSafeInteger(input.reportedAmountCents) ||
      input.reportedAmountCents < 1 || input.reportedAmountCents > 1_000_000) return null;
  return {
    clientRequestId: input.clientRequestId,
    assignmentId: input.assignmentId,
    serviceName,
    reportedAmountCents: input.reportedAmountCents,
  };
}

/** Parse dollars without floating-point rounding or silently discarding cents. */
export function dollarsToAddonCents(value: string): number | null {
  const trimmed = value.trim();
  if (!/^(?:0|[1-9]\d{0,4})(?:\.\d{1,2})?$/.test(trimmed)) return null;
  const [dollars, cents = ""] = trimmed.split(".");
  const amount = Number(dollars) * 100 + Number(cents.padEnd(2, "0"));
  return amount >= 1 && amount <= 1_000_000 ? amount : null;
}
