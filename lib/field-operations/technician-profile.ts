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
  /** Verified technician clock minutes only. */
  clockedMinutes: number;
  /** Audited HQ-entered minutes that never overwrite clock evidence. */
  manualMinutes: number;
  /** Clock + active manual time. */
  recordedMinutes: number;
  activeClocks: number;
  followUpCloseouts: number;
  scopeExceptionCloseouts: number;
  visitEvents: number;
  lastActivityAt: string | null;
  todayAssignments: number;
  todayCloseouts: number;
  todayClockedMinutes: number;
  todayManualMinutes: number;
  todayRecordedMinutes: number;
  pendingSyncJobs: number;
  liveSoldAmountCentsToday: number;
  missingTimeJobs: number;
  photoPairsCompleteToday: number;
  photoPairsMissingToday: number;
  memberPublishReadyPhotos: number;
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

export interface TechnicianProfileLiveJob {
  assignmentId: string;
  externalVisitId: string;
  clientName: string;
  serviceTitle: string;
  propertyAddress: string | null;
  scheduledStart: string;
  soldAmountCents: number | null;
  syncState: "pending_sync" | "verified";
  reconciledAt: string | null;
  clockState: "not_started" | "running" | "finished";
  clockStartedAt: string | null;
  clockEndedAt: string | null;
  closeoutSaved: boolean;
}

export interface TechnicianProfileFreshness {
  homeAtlasLiveAt: string;
  jobberLastSyncedAt: string | null;
  jobberDataFresh: boolean;
}

export interface TechnicianManualTimeEntryView {
  id: string;
  assignmentId: string | null;
  workDate: string;
  startedAt: string;
  endedAt: string;
  minutes: number;
  reason: "missed_clock" | "pre_atlas" | "owner_correction";
  note: string;
  enteredBy: string;
  enteredAt: string;
}

export interface TechnicianTimeRepairCandidate {
  assignmentId: string;
  visitDate: string;
  scheduledStart: string | null;
  clientName: string;
  serviceTitle: string;
  closeoutAt: string;
}

export interface TechnicianProfilePhotoEvidence {
  id: string;
  fieldRecordId: string;
  assignmentId: string;
  technicianId: string;
  technicianName: string;
  captureType: "before" | "after" | "detail";
  customerVisible: boolean;
  createdAt: string;
  signedUrl: string | null;
  clientName: string;
  serviceTitle: string;
  visitDate: string;
  propertyId: string | null;
  propertyName: string | null;
  membershipId: string | null;
  memberLinked: boolean;
  jobberBacked: boolean;
}

export interface TechnicianWorkdayIntegrityJob {
  assignmentId: string;
  clientName: string;
  serviceTitle: string;
  scheduledStart: string | null;
  syncState: "pending_sync" | "verified";
  closeoutSaved: boolean;
  timeSource: "clock" | "manual" | "missing";
  beforePhotos: number;
  afterPhotos: number;
  photoPairComplete: boolean;
  checksPassed: number;
  checksTotal: number;
}

export interface TechnicianWorkdayIntegrity {
  checksPassed: number;
  checksTotal: number;
  percent: number;
  jobs: TechnicianWorkdayIntegrityJob[];
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
  freshness: TechnicianProfileFreshness;
  liveJobs: TechnicianProfileLiveJob[];
  recentCloseouts: TechnicianProfileRecentCloseout[];
  manualTimeEntries: TechnicianManualTimeEntryView[];
  timeRepairCandidates: TechnicianTimeRepairCandidate[];
  photos: TechnicianProfilePhotoEvidence[];
  workdayIntegrity: TechnicianWorkdayIntegrity;
  warnings: string[];
}
