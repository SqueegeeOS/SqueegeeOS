import type { TechnicianCapacityView } from "./technician-capacity";
import type {
  IndependentDayTrial,
  TechnicianReadinessView,
} from "./technician-readiness";

export const TECHNICIAN_PROFILE_ACTIVITY_DAYS = 30;
export const TYLER_GERMANY_TECHNICIAN_ID =
  "b951a0b0-eeb8-4132-838c-497a7f4c4b9c";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isTechnicianProfileId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export interface TechnicianProfileAccess {
  grantId: string | null;
  state:
    | "active"
    | "expiring"
    | "pending"
    | "expired"
    | "revoked"
    | "missing";
  claimedAt: string | null;
  sessionExpiresAt: string | null;
  createdAt: string | null;
}

export interface TechnicianProfileActivity {
  windowDays: number;
  assignments: number;
  closeouts: number;
  clockedMinutes: number;
  activeClocks: number;
  followUpCloseouts: number;
  scopeExceptionCloseouts: number;
  visitEvents: number;
  lastActivityAt: string | null;
}

export interface TechnicianProfileRecentCloseout {
  id: string;
  externalVisitId: string;
  visitDate: string;
  followUpNeeded: boolean;
  scopeReadState: string;
  scopeException: string | null;
  createdAt: string;
}

export interface TechnicianOperationalProfile {
  generatedAt: string;
  technician: {
    id: string;
    identityKey: string;
    displayName: string;
    roleTitle: string;
    status: "active" | "inactive";
    createdAt: string;
    updatedAt: string;
  };
  access: TechnicianProfileAccess;
  readiness: TechnicianReadinessView | null;
  capacity: TechnicianCapacityView | null;
  trials: IndependentDayTrial[];
  activity: TechnicianProfileActivity;
  recentCloseouts: TechnicianProfileRecentCloseout[];
  warnings: string[];
}
