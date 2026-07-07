export type ObligationStatus =
  | "promised"
  | "scheduled"
  | "completed"
  | "missed"
  | "credited"
  | "waived"
  | "void";

export interface MembershipObligationWindow {
  sequence: number;
  membershipYear: number;
  targetWindowStart: string;
  targetWindowEnd: string;
}

export interface EnsureMembershipObligationsInput {
  membershipId: string;
  homeownerId: string;
  propertyId: string;
  visitsPerYear: number | null | undefined;
  startedAt: string;
  membershipYear?: number;
}

export interface EnsureMembershipObligationsResult {
  created: number;
  skipped: boolean;
  reason?: string;
}
