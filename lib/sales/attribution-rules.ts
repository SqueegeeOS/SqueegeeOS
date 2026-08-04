export type SalesAttributionStatus =
  | "pending"
  | "active"
  | "qualified"
  | "cancelled";

export function membershipStatusToAttributionStatus(
  membershipStatus: string,
): Exclude<SalesAttributionStatus, "qualified"> {
  if (membershipStatus === "active") return "active";
  if (["cancelled", "archived"].includes(membershipStatus)) return "cancelled";
  return "pending";
}

export function annualRateToCents(value: number | string | null): number {
  const dollars = Number(value ?? 0);
  if (!Number.isFinite(dollars) || dollars < 0) {
    throw new Error("Membership annual rate is invalid for sales attribution.");
  }
  return Math.min(100_000_000, Math.round(dollars * 100));
}
